export class Vector {
  /**
   * Immutable 3D vector
   */
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(b: Vector): Vector {
    return Vector.add(this, b);
  }

  subtract(b: Vector): Vector {
    return Vector.subtract(this, b);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalized(): Vector {
    const l = this.length();
    return new Vector(this.x / l, this.y / l, this.z / l);
  }

  scale(s: number): Vector {
    return new Vector(this.x * s, this.y * s, this.z * s);
  }

  static add(a: Vector, b: Vector): Vector {
    return new Vector(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  static subtract(a: Vector, b: Vector): Vector {
    return new Vector(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static get zero(){
    return new Vector(0,0,0);
  }

}
