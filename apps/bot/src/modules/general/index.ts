import { defineModule } from "../../core/types.js";
import { ping } from "./commands/ping.js";

export default defineModule({ name: "general", commands: [ping] });
