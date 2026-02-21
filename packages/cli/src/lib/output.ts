import pc from "picocolors";

export const ok = (msg: string) => console.log(pc.green(msg));
export const err = (msg: string) => console.error(pc.red(`error: ${msg}`));
export const info = (msg: string) => console.log(pc.cyan(msg));
export const dim = (msg: string) => console.error(pc.dim(msg));
