// Discord Priority Protocol Bot
// Requires: Node.js 18+ and discord.js v14
// npm install discord.js dotenv

require('dotenv').config(); // <-- DO NOT EDIT (loads Railway variables)
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds] // <-- DO NOT EDIT (bot only needs guild info)
});

// ============================================================
// ======================= EDIT THIS ===========================
// ============================================================

const CONFIG = {
  protocolChannelId: process.env.PROTOCOL_CHANNEL_ID, // <-- PUT CHANNEL ID IN RAILWAY VARIABLES (where embed shows)
  renameChannelId: process.env.RENAME_CHANNEL_ID, // <-- PUT CHANNEL ID IN RAILWAY VARIABLES (channel that renames)

  channelNames: {
    GREEN: "🟢┃Code-Green", // <-- NAME OF CHANNEL WHEN NORMAL OPERATIONS
    AMBER: "🟠┃Code-Amber", // <-- NAME WHEN ELEVATED STATUS
    RED: "🔴┃Code-Red" // <-- NAME WHEN CRITICAL INCIDENT
  },

  rolePermissions: {
    GREEN: ["1433430730733781062","1433430654648844438","1433428823403139082","1433428748086280212","1433427939688714332","1434427179177082993","1433427654182309959","1433427612709159066","1433427528563032174"], // <-- ROLE IDS THAT CAN SET GREEN (usually supervisors)
    AMBER: ["1433430730733781062","1433430654648844438","1433428823403139082","1433428748086280212","1433427939688714332","1434427179177082993","1433427654182309959","1433427612709159066","1433427528563032174"], // <-- WHO CAN SET AMBER
    RED: ["1433430730733781062","1433430654648844438","1433428823403139082","1433428748086280212","1433427939688714332","1434427179177082993","1433427654182309959","1433427612709159066"] // <-- WHO CAN SET RED (command only recommended)
  },

  resetHours: 12 // <-- HOURS BEFORE AUTO RESET BACK TO GREEN
};

// ============================================================
// ==================== DO NOT EDIT BELOW ======================
// ============================================================

let currentCode = "GREEN";
let resetTimeout = null;
let messageId = null;

function hasPermission(member, code) {
  const allowedRoles = CONFIG.rolePermissions[code] || [];
  return member.roles.cache.some(r => allowedRoles.includes(r.id)) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function buildEmbed(code, userTag) {
  const colors = { GREEN: 0x2ecc71, AMBER: 0xf39c12, RED: 0xe74c3c };
  const descriptions = {
    GREEN: "Normal operations \nNo active incidents.",
    AMBER: "Current Situation - Activated for 12 hours \n-Mandatory 2-up/3-up (where needed) within your division only \n-Public Order & Riot Squad are permitted to use SMGs while suspects are using pistols and up \n-Suspects are to be searched on site before medical attention",
    RED: "Critical incident — Activated for 12 hours \n-Mandatory 2-up/3-up (where needed) (prefered within your division \n-Public Order & Riot Squad are permitted to use SMGs while suspects are using pistols and up \n- Public Order & Riot Squad Senior Opperators may carry rifles \n- Public Order & Riot Squad officers MUST be in PORS Tactical Gear /n•Suspects are to be searched on site before medical attention. \n• All weapons must be seized from individuals that cause the code red (Check Announcments) \n-Phone Calls are suspended for suspects that have commited Indictable Crimes against a Person \n-Stop & Search Prtocol for indivuals and vehicles that caused the code red \n- No Inductions/Interveiws are to take place "
  };

  return new EmbedBuilder()
    .setTitle(`Protocol Status: CODE ${code}`)
    .setDescription(descriptions[code])
    .setColor(colors[code])
    .addFields({ name: "Updated By", value: userTag ?? "System", inline: true })
    .setTimestamp();
}

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('green').setLabel('Code Green').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('amber').setLabel('Code Amber').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('red').setLabel('Code Red').setStyle(ButtonStyle.Danger)
  );
}

async function renameChannel(guild, code) {
  try {
    const channel = await guild.channels.fetch(CONFIG.renameChannelId);
    if (!channel) {
      console.error("Rename channel not found. Check RENAME_CHANNEL_ID.");
      return;
    }

    await channel.setName(CONFIG.channelNames[code]);
    console.log(`Channel renamed to ${CONFIG.channelNames[code]}`);
  } catch (err) {
    console.error("Failed to rename channel:", err);
  }
}


function scheduleReset(guild) {
  if (resetTimeout) clearTimeout(resetTimeout);
  if (currentCode === "GREEN") return;

  resetTimeout = setTimeout(async () => {
    currentCode = "GREEN";
    await updateDisplay(guild, null, true);
  }, CONFIG.resetHours * 60 * 60 * 1000);
}

async function updateDisplay(guild, user, automatic = false) {
  const channel = await guild.channels.fetch(CONFIG.protocolChannelId);
  if (!channel) return;

  const embed = buildEmbed(currentCode, automatic ? "Automatic Reset" : user?.tag);

 let msg;

try {
  const existingId = process.env.STATUS_MESSAGE_ID;

  if (existingId) {
    msg = await channel.messages.fetch(existingId);
    await msg.edit({ embeds: [embed], components: [buildButtons()] });
  } else {
    msg = await channel.send({ embeds: [embed], components: [buildButtons()] });
    console.log("COPY THIS MESSAGE ID INTO RAILWAY STATUS_MESSAGE_ID:");
    console.log(msg.id);
  }

} catch {
  msg = await channel.send({ embeds: [embed], components: [buildButtons()] });
  console.log("NEW MESSAGE CREATED — COPY ID:");
  console.log(msg.id);
}


  await renameChannel(guild, currentCode);
  scheduleReset(guild);
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await updateDisplay(guild);
  } catch (err) {
    console.error("Failed to fetch guild.");
    console.error(err);
  }
});


client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const code = interaction.customId.toUpperCase();
  if (!["GREEN","AMBER","RED"].includes(code)) return;

  if (!hasPermission(interaction.member, code)) {
    return interaction.reply({ content: "You do not have permission to activate this protocol.", ephemeral: true });
  }

  currentCode = code;
  await updateDisplay(interaction.guild, interaction.user);
  await interaction.deferUpdate();
});

client.login(process.env.BOT_TOKEN); // <-- BOT TOKEN GOES INTO RAILWAY VARIABLES
