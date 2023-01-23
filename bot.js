const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require("discord.js");

const {
  token,
  prefix,
  problemUrlBase,
  ltApiUrl,
  qotdChannel,
} = require("./config.json");

const axios = require("axios");
const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const allProblems = [];
const freeProblems = [];
const paidProblems = [];
let totalProblems;

/**
 * Returns a random number based on provided max constraint.
 * @param {int} max
 */
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

/**
 * Problem class to help parse the revelant properties of a problem from the Leetcode API
 * @param {*} problemObject
 */
function Problem(problemObject) {
  this.id = problemObject.stat.question_id;
  this.title = problemObject.stat.question__title;
  this.titleSlug = problemObject.stat.question__title_slug;
  this.difficulty =
    problemObject.difficulty.level === 3
      ? "Hard"
      : problemObject.difficulty.level === 2
      ? "Medium"
      : "Easy";
  this.paidOnly = problemObject.paid_only;
  this.description = `Problem ID: ${this.id}\nTitle: ${this.title}\nSlug Title: ${this.titleSlug}\nDifficulty: ${this.difficulty}\nIs Paid? ${this.paidOnly}`;
}

/**
 * REST call to populate our arrays with data.
 */
axios
  .get(ltApiUrl)
  .then((resp) => {
    totalProblems = resp.data.num_total;
    resp.data.stat_status_pairs.forEach((problem) => {
      const newProblem = new Problem(problem);
      if (newProblem.paidOnly === false) {
        freeProblems.push(newProblem);
      } else {
        paidProblems.push(newProblem);
      }
      allProblems.push(newProblem);
    });
  })
  .catch((err) => {
    console.log(err);
  });

// Bot Startup + Hearbeat Detection
client
  .on("error", console.error)
  .on("warn", console.warn)
  .on("debug", console.log)
  .on("ready", () => {
    console.log(
      `Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`
    );
    // setInterval(() => {
    //   doQotd(freeProblems);
    // }, 15000);
    client.user.setPresence({
      status: "online",
      activity: {
        name: "with LeetCode",
        type: "PLAYING",
      },
    });
  })
  .on("disconnect", () => {
    console.warn("Disconnected!");
  })
  .on("reconnecting", () => {
    console.warn("Reconnecting...");
  })
  .on("commandError", (cmd, err) => {
    if (err instanceof commando.FriendlyError) return;
    console.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
  })
  .on("commandBlocked", (msg, reason) => {
    console.log(oneLine`
			Command ${msg.command ? `${msg.command.groupID}:${msg.command.memberName}` : ""}
			blocked; ${reason}
		`);
  })
  .on("commandPrefixChange", (guild, prefix) => {
    console.log(oneLine`
			Prefix ${prefix === "" ? "removed" : `changed to ${prefix || "the default"}`}
			${guild ? `in guild ${guild.name} (${guild.id})` : "globally"}.
		`);
  })
  .on("commandStatusChange", (guild, command, enabled) => {
    console.log(oneLine`
			Command ${command.groupID}:${command.memberName}
			${enabled ? "enabled" : "disabled"}
			${guild ? `in guild ${guild.name} (${guild.id})` : "globally"}.
		`);
  })
  .on("groupStatusChange", (guild, group, enabled) => {
    console.log(oneLine`
			Group ${group.id}
			${enabled ? "enabled" : "disabled"}
			${guild ? `in guild ${guild.name} (${guild.id})` : "globally"}.
		`);
  });

/**
 * Takes in the relevant array for the operation based on command and the message received by the bot.
 * Builds the MessageEmbed object with relevant info to be sent out to the particular channel/user.
 * @param {*} data
 * @param {*} msg
 * @param {string} diff
 * @param {string} searchQuery
 */
function problemType(data, msg, diff = "", searchQuery = "") {
  if (diff != "") {
    const filteredByDiff = data.filter(
      (problem) => problem.difficulty.toLowerCase() === diff
    );
    data = filteredByDiff;
  }
  if (searchQuery !== "") {
    filteredBySearch = data.filter(function (problem) {
      return problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    });
    if (filteredBySearch.length != 0) {
      data = filteredBySearch;
    } else {
      msg.channel.send(
        "Couldn't find a problem with what you gave me. Maybe try something less specific, or give up?"
      );
      return;
    }
  }
  const dataLen = data.length;
  const randInt = getRandomInt(dataLen);
  const randProblem = data[randInt];
  const problemUrl = problemUrlBase + randProblem.titleSlug + "/";

  const embed = new EmbedBuilder()
    .setTitle(randProblem.title)
    .setColor("#3a76f8")
    .setThumbnail(
      "https://media.csesoc.org.au/content/images/2020/01/csesoc-logo-7.png"
    )
    .setDescription(
      `${randProblem.difficulty} difficulty ${
        randProblem.paidOnly ? "locked/paid" : "unlocked/free"
      } problem.\n\nFeel free to click the title for more info!`
    )
    .setURL(problemUrl);
  msg.channel.send({ embeds: [embed] });
}

const helpEmbed = new EmbedBuilder()
  .setColor("#3a76f8")
  .setThumbnail(
    "https://media.csesoc.org.au/content/images/2020/01/csesoc-logo-7.png"
  )
  .setTitle("Usage:")
  .setDescription(
    "?problem (without args) - gives you a random problem of any difficulty.\n\n\t?problem <easy | medium | hard> - gives you a random problem of the specified difficulty.\n\n\t?info - returns data on leetcode problems."
  );

client.on("messageCreate", (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).trim().split(" ");
  const command = args.shift().toLowerCase();
  let diff;

  if (typeof args[0] != "undefined") {
    const temp = args[0].toLowerCase();
    if (["easy", "medium", "hard"].indexOf(temp) >= 0) {
      diff = temp;
    }
  }

  let searchQuery = "";
  if (
    args.length >= 2 ||
    args[0] != "easy" ||
    args[0] != "medium" ||
    args[0] != "hard"
  ) {
    if (args[0] == "easy" || args[0] == "medium" || args[0] == "hard")
      args.splice(0, 1);
    searchQuery = args.join(" ");
    console.log(searchQuery);
  }

  if (command === "info") {
    msg.channel.send(
      `Leetcode currently has a total of ${totalProblems} problems of which ${freeProblems.length} are free, and ${paidProblems.length} are paid.`
    );
  } else if (command === "problem") {
    problemType(freeProblems, msg, diff, searchQuery);
  } else if (command === "help") {
    msg.channel.send({ embeds: [helpEmbed] });
  } else {
    msg.channel.send(
      "Invalid command! Feel free to do !help for a list of the commands."
    );
  }
});

/**
 * Takes in array containing free problems, finds a random problem and sends relevant info into specified channel.
 * @param {*} data
 */
function doQotd(data) {
  const dataLen = data.length;
  const randInt = getRandomInt(dataLen);
  const randProblem = data[randInt];
  const problemUrl = problemUrlBase + randProblem.titleSlug + "/";

  const qotdEmbed = new EmbedBuilder()
    .setTitle("Problem of the Day\n")
    .setColor("#3a76f8")
    .setThumbnail(
      "https://media.csesoc.org.au/content/images/2020/01/csesoc-logo-7.png"
    )
    .setDescription(randProblem.title)
    .setFooter({
      text: `${randProblem.difficulty} difficulty ${
        randProblem.paidOnly ? "locked/paid" : "unlocked/free"
      } problem.`,
      iconURL: "https://leetcode.com/static/images/LeetCode_logo_rvs.png",
    })
    .setURL(problemUrl);
  client.channels.cache.get(qotdChannel).send({ embeds: [qotdEmbed] });
}

client.login(token);
