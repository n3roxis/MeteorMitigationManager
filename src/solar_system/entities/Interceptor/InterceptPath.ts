import {UpdatableEntity} from "../Entity.ts";
import {Vector} from "../../utils/Vector.ts";
import {Application, Graphics} from "pixi.js";
import {Meteor} from "../Meteor.ts";
import {performance} from "perf_hooks";
import {lambertIzzo} from "../../utils/lambert_solver.ts";
import {DEBUG_AU, MSunxGperAU3} from "../../utils/constants.ts";
import {propagateMeteorToTime} from "./MeteorPrediction.ts";
import {computePathWithTimestamps, drawPath, PathPoint} from "./PathDrawer.ts";

type LambertPathType = {
  departurePoint: Vector,
  departureVelocity: Vector,
  departureDeltaVelocity: Vector,
  arrivalPoint: Vector,
  arrivalVelocity: Vector,
  arrivalDeltaVelocity: Vector,
  flightTime: number
}

type LambertPathEvaluationType = LambertPathType & {
  fuelConsumptionMass?: number,
  meteorVelocityChange?: Vector,
}

export class InterceptPath implements UpdatableEntity {

  id: string;
  position: Vector = new Vector(0, 0, 0); // reserved for flying rocket

  startEntity: UpdatableEntity;
  targetEntity: Meteor;

  private get startPosition() {
    return this.startEntity.position;
  }

  startVelocity: Vector | null = null;

  draw: boolean;
  color: number;
  private gfx: Graphics | null = null;

  constructor(id: string, startEntity: UpdatableEntity, targetEntity: Meteor, draw: boolean = false, color: number = 0x00ff55) {
    this.id = id;
    this.startEntity = startEntity;
    this.targetEntity = targetEntity;
    this.draw = draw;
    this.color = color;
  }

  start(app: Application): void {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  private previousStartPosition: Vector | null = null;

  private updatePreviousPoint(dt: number) {
    if (this.previousStartPosition) {
      const delta = this.startPosition.subtract(this.previousStartPosition);
      this.startVelocity = delta.scale(1 / dt);
    }
    this.previousStartPosition = this.startPosition;
  }

  update(dt: number): void {
    this.updatePreviousPoint(dt)
  }

  chosenPath: LambertPathEvaluationType | null = null;
  trace: PathPoint[] | null = null;

  drawTrace() {
    if (!this.graphics) return;
    if (!this.trace) return;
    drawPath(this.graphics, this.trace)
  }

  calculatePath() {
    if (!this.chosenPath) return null;

    const {points,} = computePathWithTimestamps(
      this.chosenPath.departurePoint,
      this.chosenPath.departureVelocity,
      this.chosenPath.flightTime
    )

    this.trace = points;
  }

  trajectories: LambertPathEvaluationType[] = [];

  findTrajectories(transportSecondsTries: number [], impactorMass: number) {

    const evaluations: LambertPathEvaluationType[] = [];

    for (let i = 0; i < transportSecondsTries.length; i++) {
      try {
        console.log(`DebugLog: Trying ${transportSecondsTries[i]} seconds`)
        const evaluation: LambertPathEvaluationType = this.calculateTrajectory(transportSecondsTries[i]);
        console.log("Success")
        evaluation.fuelConsumptionMass = this.calculateFuelMass(impactorMass, evaluation.departureDeltaVelocity.length());
        evaluation.meteorVelocityChange = evaluation.arrivalDeltaVelocity.scale(impactorMass / this.targetEntity.mass);
        evaluations.push(evaluation);
      } catch (e) {
        console.log("Failure")
      }
    }

    console.log(`DebugLog: Found ${evaluations.length} possible paths in ${transportSecondsTries.length} tries`)

    this.trajectories = evaluations;

    return evaluations.length;
  }

  chooseTrajectory(index: number) {
    if (index < 0 || index >= this.trajectories.length) {
      console.log("Bad index: ", index, " out of range [0, ", this.trajectories.length,)
      return;
    }
    this.chosenPath = this.trajectories[index];
  }

  printTrace() {
    if (!this.chosenPath) return;
    console.log("DebugLog: Chosen trajectory: ", this.trace)
  }

  drawTrajectory() {
    if (!this.chosenPath) return;
    if (!this.gfx) return;
    this.gfx.clear();
    this.gfx.lineStyle(2, this.color);
  }

  private calculateFuelMass(massPayload: number, deltaVelocity: number, exhaustVelocity = 1800 / DEBUG_AU) {
    // Assume you burn all of the fuel
    return massPayload * (Math.exp(deltaVelocity / exhaustVelocity) - 1)
  }

  private calculateTrajectory(transportSeconds = 86400 * 365.25 / 12): LambertPathType {
    const startPoint = this.startPosition;
    const {
      position: predictedEndPoint,
      velocity: predictedVelocity
    } = propagateMeteorToTime(this.targetEntity, transportSeconds)

    const [departureVelocity, arrivalVelocity] = lambertIzzo(MSunxGperAU3, startPoint, predictedEndPoint, transportSeconds);

    return {
      departurePoint: startPoint,
      departureVelocity: departureVelocity,
      departureDeltaVelocity: departureVelocity.subtract(this.startVelocity ?? new Vector(0, 0, 0)),
      arrivalPoint: predictedEndPoint,
      arrivalVelocity: arrivalVelocity,
      arrivalDeltaVelocity: arrivalVelocity.subtract(predictedVelocity),
      flightTime: transportSeconds
    }
  }


  destroy(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }

  get graphics(): Graphics | null {
    return this.gfx;
  }

}
