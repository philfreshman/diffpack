export const FOV = 60;

export interface SkyView {
	width: number;
	height: number;
}

export function halfHeightAt(z: number): number {
	return Math.tan((FOV * Math.PI) / 360) * Math.abs(z);
}
