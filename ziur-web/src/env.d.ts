/// <reference path="../.astro/types.d.ts" />
declare function qrcode(type: number, errorCorrectionLevel: string): {
    addData(data: string): void;
    make(): void;
    createSvgTag(cellSize: number, margin: number): string;
};