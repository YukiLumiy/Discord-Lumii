import { defineModule } from "../../core/types.js";
import { welcomeConfig } from "./commands/welcome-config.js";
import { welcomeTest } from "./commands/welcome-test.js";
import { welcomeOnJoin } from "./events/guildMemberAdd.js";
import { welcomeOnLeave } from "./events/guildMemberRemove.js";

/** Welcome / Leave Message - 参加・退出時にパネルを送信(文面は {user} {username} {server} {count} が使える) */
export default defineModule({
  name: "welcome",
  commands: [welcomeConfig, welcomeTest],
  events: [welcomeOnJoin, welcomeOnLeave],
});
