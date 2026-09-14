import { mkdir, writeFile } from "node:fs/promises";
const scenes = {
  rift: {
    colors: ["#152f43", "#2c6b72"],
    shapes:
      '<path d="M0 240 95 80 157 153 263 32 377 151 420 100 640 253V360H0" fill="#182d36"/><path d="M0 272 155 195 260 263 405 161 640 270V360H0" fill="#396359"/><path d="m145 360 182-145 71-23-88 168" fill="#73a9a0"/><path d="m309 209 11-71 14-27 13 29-2 57" fill="#90d6dd"/><path d="m279 208 29-29 11 29-8 16" fill="#b3e9c1"/><path d="m392 193 16-72 18 30 11 53" fill="#375557"/>',
    label: "THE SUMMONER'S JOURNEY",
    subtitle: "A NEW CHALLENGE AWAITS",
    accent: "#b9dbb8",
  },
  island: {
    colors: ["#80b1bd", "#cad7ac"],
    shapes:
      '<circle cx="490" cy="82" r="37" fill="#f0d99d"/><path d="M0 255 143 166 298 194 404 156 640 249V360H0" fill="#5b8b83"/><path d="m122 219 154-81 173 79-155 86z" fill="#82a457"/><path d="m122 219 172 84v43l-172-76z" fill="#5c6744"/><path d="m294 303 155-86v51l-155 78z" fill="#766a43"/><path d="m222 197 57-29 51 26-52 31z" fill="#d9c290"/><path d="m222 197 56 28v39l-56-30z" fill="#ba9f68"/><path d="m278 225 52-31v41l-52 29z" fill="#e1cd95"/><path d="m215 197 63-62 57 59-57 31z" fill="#d0b46c"/><path d="M176 214v-68m208 75v-82" stroke="#5b6240" stroke-width="14"/><path d="m136 162 42-74 38 74zM342 161l41-88 44 88z" fill="#427757"/><path d="M0 326q160-37 240 14t200-3 200-5" fill="none" stroke="#c0e0d3" stroke-width="3"/>',
    label: "A LITTLE WORLD",
    subtitle: "BUILD SOMETHING BEAUTIFUL",
    accent: "#f5f4d4",
  },
  sunset: {
    colors: ["#89759a", "#e8a880"],
    shapes:
      '<circle cx="412" cy="167" r="61" fill="#ffda9c"/><path d="M0 210q155-50 288 18t352-5v137H0" fill="#575e89"/><path d="M0 262q162-41 300-3t340-5v107H0" fill="#484964"/><path d="M0 308q104-29 240 8t400-6v50H0" fill="#343b55"/><path d="m270 254 167 0m-129 16h95m-64 19h95" stroke="#dea39f" stroke-width="3" stroke-linecap="round"/><path d="M520 252v-67l32 55h-32" fill="#293e53"/><path d="m501 250 74-2-13 16h-49" fill="#242f47"/>',
    label: "SLOW DOWN, STAY AWHILE",
    subtitle: "A MOMENT JUST FOR US",
    accent: "#fff0d7",
  },
  night: {
    colors: ["#344953", "#bdaf81"],
    shapes:
      '<path d="M0 200 95 173 210 225 340 138 454 195 640 156v204H0" fill="#3a4444"/><path d="M0 291 223 227 436 244 640 208v152H0" fill="#565d4e"/><path d="M0 329 236 287 640 286v74H0" fill="#333c39"/><path d="m375 295 13-86 8-25 29-5 28 22 6 46-27 12-5 52h-15l-9-61-9 63z" fill="#202b29"/><ellipse cx="410" cy="165" rx="17" ry="20" fill="#2a3330"/><path d="m399 218 74-8 3 8-74 13z" fill="#1a2425"/><path d="M124 257v-54l72-19 52 27v46z" fill="#565646"/><path d="m113 207 71-41 77 44" fill="#2f3933"/><path d="m10 340 12-36m35 52 9-28m461 28 9-34m45 24 10-36" stroke="#768064" stroke-width="4"/>',
    label: "ONE MORE ROUND",
    subtitle: "STAY SHARP. STAY TOGETHER.",
    accent: "#f0e7be",
  },
  music: {
    colors: ["#483e50", "#c69980"],
    shapes:
      '<rect x="337" y="58" width="176" height="188" rx="3" fill="#d4b6ac"/><rect x="348" y="68" width="154" height="165" fill="#797f91"/><path d="M425 68v165M348 155h154" stroke="#b7a398" stroke-width="8"/><path d="M353 73v33m21-12v23m92 14v33m-14-75v29m-67 40v32m107-7v39" stroke="#c7cbca" stroke-width="2" opacity=".6"/><path d="M0 277 640 245v115H0" fill="#51414b"/><path d="m160 228 224-32 76 66-250 54z" fill="#21212e"/><path d="m170 243 220-31 47 40-228 46z" fill="#ded5c9"/><path d="m187 240 32 44m-5-48 34 45m-4-51 34 45m-5-49 35 44m-3-49 33 43m-3-47 35 43m-5-47 36 42" stroke="#48404a" stroke-width="9"/><path d="m217 315 5 43m197-86 9 59" stroke="#252332" stroke-width="13"/><path d="M101 283v-88m-27 54 27 16 35-37m-46-6 12 23" stroke="#5b705a" stroke-width="9"/><path d="m81 281 43-2-5 41H86z" fill="#b1957f"/>',
    label: "RAINY DAY PLAYLIST",
    subtitle: "LET THE MUSIC FIND YOU",
    accent: "#fae6cc",
  },
  neon: {
    colors: ["#302743", "#675990"],
    shapes:
      '<path d="M0 0h168l-15 360H0" fill="#2a2b43"/><path d="m420 0 220 0v360H461" fill="#3a2b4c"/><path d="m186 0-56 360m334-360 61 360" stroke="#b977d5" stroke-width="6"/><path d="m209 0-43 360m274-360 33 360" stroke="#73abc9" stroke-width="2"/><path d="M270 360 320 141 365 360" fill="#545478"/><path d="m217 230 100-62 98 63-54 111H257z" fill="#585584"/><path d="m274 181 17-49 42-8 31 45-12 61-54-6z" fill="#b4a6c8"/><path d="m278 159 11-49 62 9 19 34-59-6z" fill="#39334e"/><path d="m194 259 91-20 104 66-13 17-98-43-74 1z" fill="#d1b4b5"/><path d="m262 262 93-13 24 16-71 21z" fill="#332a4a"/>',
    label: "NEXT LEVEL",
    subtitle: "MAKE EVERY MOMENT COUNT",
    accent: "#d2f0f0",
  },
  stadium: {
    colors: ["#284b4e", "#a2bab1"],
    shapes:
      '<path d="M0 173q320 91 640-4v191H0" fill="#3a6b59"/><path d="M0 280q320-135 640 0v80H0" fill="#73a877"/><path d="M0 318q320-140 640 0v42H0" fill="#659564"/><ellipse cx="320" cy="314" rx="112" ry="30" fill="none" stroke="#c1d2a0" stroke-width="3"/><path d="M320 264v96M52 292l48 13v55m488-67-48 12v55" fill="none" stroke="#c1d2a0" stroke-width="3"/><path d="M70 226V73m490 153V73" stroke="#416064" stroke-width="7"/><path d="M34 76h72M522 76h72" stroke="#e1e6ba" stroke-width="13"/><path d="M80 102 160 234M548 102 468 230" stroke="#c6d4b9" stroke-width="27" opacity=".12"/>',
    label: "BETTER TOGETHER",
    subtitle: "IT IS MORE THAN A GAME",
    accent: "#ecf4cc",
  },
  space: {
    colors: ["#332b52", "#785a83"],
    shapes:
      '<circle cx="451" cy="140" r="83" fill="#c09da4"/><ellipse cx="451" cy="147" rx="138" ry="23" fill="none" stroke="#a485b2" stroke-width="15" transform="rotate(-25 451 147)"/><path d="M0 314 77 259 209 307 331 267 475 310 640 265v95H0" fill="#30243f"/><circle cx="179" cy="223" r="15" fill="#d6c7d1"/><path d="m168 242 28-1 11 51-22 15-27-10z" fill="#bfb1ca"/><path d="m164 292-8 27m37-22 9 24" stroke="#bfb1ca" stroke-width="10"/><path d="m210 268 21-32" stroke="#c8bbd2" stroke-width="6"/><path d="m228 237 7 58m-6-56 47 10-40 14" fill="#adc998" stroke="#baca9f" stroke-width="3"/>',
    label: "SOMEWHERE BEYOND",
    subtitle: "EVERY STORY STARTS HERE",
    accent: "#e5d9ef",
  },
};
await mkdir("public/art", { recursive: true });
for (const [name, scene] of Object.entries(scenes)) {
  const stars = Array.from(
    { length: 17 },
    (_, i) =>
      `<circle cx="${(i * 127 + 43) % 640}" cy="${(i * 37 + 19) % 190}" r="${i % 3 === 0 ? 1.6 : 0.9}" fill="${scene.accent}" opacity=".35"/>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${scene.colors[0]}"/><stop offset="1" stop-color="${scene.colors[1]}"/></linearGradient><linearGradient id="shade" x2="1" y2="1"><stop stop-color="#071015" stop-opacity=".5"/><stop offset="1" stop-color="#071015" stop-opacity="0"/></linearGradient></defs><rect width="640" height="360" fill="url(#sky)"/>${stars}${scene.shapes}<rect width="640" height="360" fill="url(#shade)"/><text x="28" y="117" fill="${scene.accent}" font-family="Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="1">${scene.label}</text><text x="30" y="140" fill="${scene.accent}" opacity=".7" font-family="Arial,sans-serif" font-size="9" letter-spacing="3">${scene.subtitle}</text><text x="609" y="23" text-anchor="end" fill="#fff" opacity=".4" font-family="Arial,sans-serif" font-size="8" letter-spacing="1">LIVESCOPE ORIGINAL · SAMPLE</text></svg>`;
  await writeFile(`public/art/${name}.svg`, svg);
}
console.log("Created 8 original sample illustrations.");
