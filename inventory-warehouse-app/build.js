import { cpSync, existsSync, mkdirSync, rmSync } from "fs";

if (existsSync("dist")) rmSync("dist", { recursive: true });
mkdirSync("dist", { recursive: true });
for (const file of ["index.html", "styles.css", "app.js", "core.js"]) cpSync(file, `dist/${file}`);
cpSync("../public/infobridgeindia-logo.png", "dist/infobridgeindia-logo.png");
console.log("Built Inventory & Warehouse app into inventory-warehouse-app/dist");
