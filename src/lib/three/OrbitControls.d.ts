import { Camera } from "three";

export class OrbitControls {
    constructor(object: Camera, domElement: HTMLElement);
    enabled: boolean;
    update(): boolean;
    dispose(): void;
}
