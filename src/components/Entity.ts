export class Entity{
    name: string;
    x: number;
    y: number;
    radius: number;

    constructor(name: string, x: number, y: number, radius: number) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.radius = radius;
    }
}