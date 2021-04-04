const jwt = require("jsonwebtoken");
const rp = require("request-promise");
var throttle = require("promise-ratelimit")(110);
const moment = require("moment");
const { uniq, mapValues, keyBy, keys, values, entries } = require("lodash");
const fs = require("fs");
require("dotenv").config({ path: __dirname + "/.env" });
const { default: readline } = require("readline-promise");
const { response } = require("express");
const ask = async (prompt) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const response = await rl.questionAsync(prompt);
  rl.close();
  return response;
};
// const me = "Ian Campbell";
// const pmi = `9361574590`;

function displayMeeting(meeting) {
  const {
    duration,
    start_time,
    participants,
    end_time,
    billedOn,
    uuid,
  } = meeting;
  return {
    uuid,
    start_time,
    billedOn,
    start: moment(start_time).format("MMM Do YYYY [at] h:mm a"),
    end: moment(end_time).format("MMM Do [at] h:mm a"),
    participants: uniq(
      participants.map((p) => p.name).filter((name) => name != process.env.me)
    ),
    duration,
  };
}

const hasName = (prefix) => (meeting) => {
  return meeting.participants.some(({ name }) =>
    name
      .split(" ")
      .some((name) => name.toLowerCase().startsWith(prefix.toLowerCase()))
  );
};

exports.run = async function ([command, name, ...rest]) {
  const { meetings, save } = await loadMeetings();
  const lessons = values(meetings)
    .filter(hasName(name))
    .map(displayMeeting)
    .sort((a, b) => {
      return a.start_time - b.start_time;
    });
  const commands = {
    list: ([length]) => {
      const duration = lessons
        .slice(0, length)
        .reduce((total, { duration }) => duration + total, 0);
      console.log(lessons.slice(0, length));
      console.log("total minutes:", duration);
    },
    bill: async ([timePivot]) => {
      let pending = lessons.filter((l) => !l.billedOn);
      if (timePivot)
        pending = pending.slice(
          ...(timePivot > 0 ? [-timePivot, undefined] : [undefined, pivot])
        );
      const totalMinutes = pending.reduce(
        (total, { duration }) => duration + total,
        0
      );
      const count = pending.length;
      console.log(pending, { totalMinutes, count });

      const shouldUpdate = await ask(
        "Would you like to mark these as billed? "
      );
      if (shouldUpdate.toLowerCase() === "y") {
        pending.forEach(({ uuid }) => (meetings[uuid].billedOn = new Date()));
        save(meetings);
        console.log("updated to: ", pending);
      }
    },
  }[command](rest);
};

async function promptForCredentials() {
  const env = {
    me:
      process.env.me ??
      (await ask("Your name is missing: what is your zoom full name?")),
    APIKey:
      process.env.APIKey ??
      (await ask("APIKey missing: What is your zoom jwt api key?")),
    APISecret:
      process.env.APISecret ??
      (await ask("APISecret missing: What is your api secret?")),
    pmi:
      process.env.pmi ??
      (await ask("PMI missing: What is your personal meeting id?")),
  };
  fs.writeFileSync(
    __dirname + "/.env",
    entries(env)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n")
  );
}

async function loadMeetings() {
  await promptForCredentials();
  const payload = {
    iss: process.env.APIKey,
    exp: new Date().getTime() + 60 * 60 * 1000,
  };
  const meetingsPath = __dirname + "/meetings.json";
  const token = jwt.sign(payload, process.env.APISecret);
  const base = "https://api.zoom.us/v2";
  const meetingUrl = (meetingUUID) => `/past_meetings/${meetingUUID}`;
  const participantsUrl = (meetingUUID) =>
    `/past_meetings/${meetingUUID}/participants`;

  instances = (id) => `/past_meetings/${id}/instances`;
  const opts = {
    auth: { bearer: token },
    json: true,
  };
  const cached = JSON.parse(fs.readFileSync(meetingsPath).toString());
  const ids = keys(cached);

  const { meetings: meetingIds } = await rp(
    base + instances(process.env.pmi),
    opts
  );
  const uuids = meetingIds
    .filter((m) => !ids.includes(m.uuid))
    .map((m) => (m.uuid.startsWith("/") ? encodeURIComponent(m.uuid) : m.uuid));

  const meetingPromise = async (uuid) =>
    await Promise.all(
      [participantsUrl(uuid), meetingUrl(uuid)].map((url) =>
        throttle().then(() => rp(base + url, opts).catch((err) => {}))
      )
    );
  const meetings = await Promise.all(uuids.map(meetingPromise));
  const flat = meetings
    .map(([participants, details]) => ({
      ...participants,
      ...details,
    }))
    .filter((m) => m.uuid);
  const finalMeetings = [...values(cached), ...flat].map((entry) => ({
    ...entry,
    start_time: moment(entry.start_time),
  }));
  return {
    meetings: keyBy(finalMeetings, "uuid"),
    save: (inp) => fs.writeFileSync(meetingsPath, JSON.stringify(inp)),
  };
}

function loadBills(lessons) {
  //{id, date}
  !fs.existsSync("bills.json") && fs.writeFileSync("bills.json", "[]");
  const bills = JSON.parse(fs.readFileSync("bills.json").toString());
}
