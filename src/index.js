const jwt = require("jsonwebtoken");
const rp = require("request-promise");
var throttle = require("promise-ratelimit")(110);
const moment = require("moment");
const { uniq, mapValues, keyBy, keys, values } = require("lodash");
const fs = require("fs");

// const oldMeetings = JSON.parse(fs.readFileSync("meetings.json").toString());
// fs.writeFileSync("meetings.json", JSON.stringify(keyBy(oldMeetings, "uuid")));
// return;
const { default: readline } = require("readline-promise");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

require("dotenv").config();
const me = "Ian Campbell";
const pmi = `9361574590`;

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
      participants.map((p) => p.name).filter((name) => name != me)
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
    bill: async ([pivot]) => {
      let pending = lessons.filter((l) => !l.billedOn);
      if (pivot)
        pending = pending.slice(
          ...(pivot > 0 ? [-pivot, undefined] : [undefined, pivot])
        );
      console.log(pending, pivot);
      const shouldUpdate = await rl.questionAsync(
        "Would you like to mark these as billed? "
      );
      rl.close();
      if (shouldUpdate.toLowerCase() === "y") {
        pending.forEach(({ uuid }) => (meetings[uuid].billedOn = new Date()));
        save(meetings);
        console.log("updated to: ", pending);
      }
    },
  }[command](rest);
};

async function loadMeetings() {
  const payload = {
    iss: process.env.APIKey,
    exp: new Date().getTime() + 60 * 60 * 1000,
  };
  const token = jwt.sign(payload, process.env.APISecret);
  const base = "https://api.zoom.us/v2";
  const meeting = (meetingUUID) => `/past_meetings/${meetingUUID}`;
  const participants = (meetingUUID) =>
    `/past_meetings/${meetingUUID}/participants`;

  instances = (id) => `/past_meetings/${id}/instances`;
  const opts = {
    auth: { bearer: token },
    json: true,
  };
  const cached = JSON.parse(fs.readFileSync("meetings.json").toString());
  const ids = keys(cached);

  return await rp(base + instances(pmi), opts).then(
    async ({ meetings: meetingIds }) => {
      uuids = meetingIds
        .filter((m) => !ids.includes(m.uuid))
        .map((m) =>
          m.uuid.startsWith("/") ? encodeURIComponent(m.uuid) : m.uuid
        );

      const all = await Promise.all(
        uuids.map(
          async (uuid) =>
            await Promise.all(
              [participants(uuid), meeting(uuid)].map((url) =>
                throttle().then(() => rp(base + url, opts).catch((err) => {}))
              )
            )
        )
      );

      const flat = all
        .map(([participants, details]) => ({
          ...participants,
          ...details,
        }))
        .filter((m) => m.uuid);
      let meetings = [...values(cached), ...flat].map((entry) => ({
        ...entry,
        start_time: moment(entry.start_time),
      }));
      return {
        meetings: keyBy(meetings, "uuid"),
        save: (inp) => fs.writeFileSync("meetings.json", JSON.stringify(inp)),
      };
    }
  );
}

function loadBills(lessons) {
  //{id, date}
  !fs.existsSync("bills.json") && fs.writeFileSync("bills.json", "[]");
  const bills = JSON.parse(fs.readFileSync("bills.json").toString());
}
