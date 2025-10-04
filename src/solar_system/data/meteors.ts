import {Meteor} from "../entities/Meteor";
import { DEBUG_AU } from "../utils/constants";


export const METEOR_UNO = new Meteor('meteor_uno', -1.4, 0, 0, 0, 24130 / 6 / DEBUG_AU, 0, 0xc0c0c0)


export const METEORS = [
  METEOR_UNO
];