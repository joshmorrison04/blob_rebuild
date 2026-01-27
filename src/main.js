import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Sentiment analysis options:
// NOTE: These are now a fallback lexicon in case the JSON file doesn't load.
// We'll still load a bigger lexicon from /emotion_words.json for better results.
const angerWords = ["angry", "mad", "furious", "hate", "pissed", "annoyed", "rage", "frustrated"];
const joyWords = ["happy", "excited", "joy", "fun", "love", "great", "awesome", "good"];
const sadWords = ["sad", "tired", "down", "depressed", "lonely", "upset", "empty", "low"];

// read what the user is typing:
const userTextInput = document.getElementById("userText");

// Debug panel: shows emotion values + speed/amplitude in real time
// COMMENTED OUT - debug panel disabled for cleaner UI
/*
const debugPanel = document.createElement("div");
debugPanel.id = "debugPanel";
debugPanel.style.position = "fixed";
debugPanel.style.top = "20px";
debugPanel.style.right = "20px";
debugPanel.style.padding = "12px 14px";
debugPanel.style.background = "rgba(0,0,0,0.55)";
debugPanel.style.border = "1px solid rgba(255,255,255,0.15)";
debugPanel.style.borderRadius = "10px";
debugPanel.style.fontFamily = "monospace";
debugPanel.style.fontSize = "12px";
debugPanel.style.lineHeight = "1.35";
debugPanel.style.color = "white";
debugPanel.style.zIndex = "9999";
debugPanel.style.minWidth = "220px";
debugPanel.innerHTML = "Loading...";
document.body.appendChild(debugPanel);
*/


// 1.) Create Canvas
// Create renderer object that knows how to draw 3D scenes using WebGL onto a canvas.
// { antialias: true}; When drawing pixels later, smooth jagged edges
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Changing background color
renderer.setClearColor(0x242424, 1.0);

// Sets the canvas dimensions of the 3d figure to match the size of the browser window.
renderer.setSize(window.innerWidth, window.innerHeight);

// Add the cavas into the html page (document) specifically into it's body.
document.body.appendChild(renderer.domElement);

// 2.) Create World (Scene)
// Creates an empty 3D scene that will hold all objects we want to render.
// In Three.Scene, Scene is a container that holds all 3d objects
const scene = new THREE.Scene();

// 3.) Create Camera
// Camera: our viewpoint into the scene
// in THREE.PerspctiveCamera, PersectiveCamera is a camera that mimics human vision via depth perspective
// ^ Objects farther away appear smaller. Orthographic camera for example do not have depth persepctive
const camera = new THREE.PerspectiveCamera(
  45, // FOV
  window.innerWidth / window.innerHeight, // Width divided by heigh; so the camera's view shape matches the browser window shape
  0.1, // Anything closer than 0.1 units is invisible/not rendered
  1000 // Anything farther than 1000 units is invisible/not rendered
);

// Position is a property of the camera {x, y, z} {right, up, back/away from origin}
camera.position.set(6, 0, 14);

// Connects your mouse input on the canvas to camera movement
// OrbitControls enables interactive mouse, touch, and keyboard controls
// ^ Ultimately manipulating the camera's view around a target point in a 3D Scene
// camera argument: OrbitControls will move/rotate this camera when you drag
// renderer.domElement: Listens for mouse events (drag, scroll, etc.)
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.update(); // OrbitControls object; syncs the controls immediately.

// 4.) Put object in world
// Creative a geometry object
// IcosahedronGeometry is a Geometry class used to create a polyhedron with 20 identical triangular faces.
// NOTE: If performance ever becomes an issue, the detail level is the first knob to turn down.
const detailLevel = window.innerWidth <= 768 ? 16 : 32; // Lower detail on mobile for better performance
const geo = new THREE.IcosahedronGeometry(4, detailLevel); // (radius, detail level (how subdivided it is))

// Create Uniforms, created one named u_time starting at 0.
// Uniform is constant global variable that remains constant for all
// verticies during a single draw cell or frame in an object.
//
// Also add uniform values for RGB coloring
// Also add uniform values for speed and amplitude
const uniforms = {
  u_time: { value: 0.0 },
  u_r: { value: 0.0 },
  u_g: { value: 0.0 },
  u_b: { value: 0.0 },
  u_speed: { value: 0.0 },
  u_amplitude: { value: 0.0 }
};

// MeshBasicMaterial is a simple unlit material for rendering geometries and
// drawing them as flat shapes without being affected by light
// wireframe: Tells the material to render a 3D model's geometry as a a series of lines (edges)
// forming its structure, rather than as a solid shape
//
// Changed MeshBasicMaterial to ShaderMaterial, which creates a material
// Whose shape is controlled by GLSL shaders (vertex and fragment shader)
const mat = new THREE.ShaderMaterial({
  wireframe: true,
  // Attaching uniform property name to my uniform constant/object
  // I created, which value will change which the shader uses, which will then change the shape.
  uniforms: uniforms,
  // extacting vertex and fragment shader from index.html so we can get
  // it into javascript and use it to make material.
  // getElementById("") is the node point to the HTML Element id in index.html,
  // .textContent is the actual code inside the HTML element id.
  vertexShader: document.getElementById("vertexshader").textContent,
  fragmentShader: document.getElementById("fragmentshader").textContent
});

// Create a clock: A Three.js helper that tracks elapsed time
const clock = new THREE.Clock();

// Creates a renderable object called a mesh by combining the geo(shape) and mat(appearance)
const mesh = new THREE.Mesh(geo, mat);
// Puts mesh onto scence container
scene.add(mesh);

// These are displayed in the debug panel so we can see what's happening
let dbgAngerPct = 0.0;
let dbgJoyPct = 0.0;
let dbgSadPct = 0.0;
let dbgDrama = 0.0;
let dbgHits = 0;
let dbgTotalWords = 0;
let dbgBaselineBoost = 0.0;


// Creating usable variables for RGB values
let r = 0.0;
let g = 0.0;
let b = 0.0;

// Presets (your “neutral” baseline)
const BASE_SPEED = 1.0;
const BASE_AMP = 0.6;

// Target speed and amp
let targetSpeed = 1.0;
let targetAmplitude = 0.6;

// Defining speed and amplitude:
let speed = targetSpeed;
let amplitude = targetAmplitude;

// For color soothing: 
let currentR = 0.18, currentG = 0.18, currentB = 0.22;  
let targetR  = 0.18, targetG  = 0.18, targetB  = 0.22;

const COLOR_LERP = 0.06; // smaller = slower bleed (try 0.03–0.10)


// How strongly percentages affect the blob (tune these)
const ANGER_SPEED_BOOST = 2.0;
const ANGER_AMP_BOOST = 1.2;

const SAD_SPEED_DROP = 1.0;
const SAD_AMP_DROP = 0.6;

// Joy is “neutral” in your plan, so it mostly pulls back toward base.
// You can keep these 0 if you want joy to do nothing.
const JOY_SPEED_BOOST = 0.1;
const JOY_AMP_BOOST = 0.1;

// Clamp helper so values dont go too high/low and break the shader
function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

// variable for reading user input
let userText = "";

// Lerp function so the shape can smoothly transition to its other values
const smooth = 0.08;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* -------------------------------------------------------------------------- */
/*  Typing baseline: blob should respond even when no emotion words match      */
/* -------------------------------------------------------------------------- */

// This makes the blob feel alive as the user types, even for neutral passages.
// typingEnergy spikes on input and decays slowly in animate().
let typingEnergy = 0.0; // 0..1
let lastTypedAt = 0.0;

/* -------------------------------------------------------------------------- */
/*  A) External lexicon file (JSON) + fallback lexicon                         */
/* -------------------------------------------------------------------------- */

// This will hold our loaded JSON data once it is fetched
let LEXICON = null;

// Cache phrase matches so we don't rebuild the phrase list every time you type
let CACHED_PHRASES = [];

// normalize Lexicon: 
function normalizeLexiconKeys(lexicon) {
  const out = { anger: {}, joy: {}, sad: {} };

  for (const emotion of Object.keys(lexicon)) {
    out[emotion] = {};

    for (const [rawKey, weight] of Object.entries(lexicon[emotion])) {
      // phrases handled elsewhere, keep as-is here
      if (rawKey.includes(" ")) {
        out[emotion][rawKey] = weight;
        continue;
      }

      const k1 = rawKey.toLowerCase();
      const k2 = normalizeToken(k1);

      // store both forms so either token style matches
      out[emotion][k1] = Math.max(out[emotion][k1] ?? 0, weight);
      out[emotion][k2] = Math.max(out[emotion][k2] ?? 0, weight);
    }
  }

  return out;
}


// Fallback lexicon built from your original arrays (weights are simple defaults)
function buildFallbackLexicon() {
  const lex = { anger: {}, joy: {}, sad: {} };

  // Each word is given a default weight of 1.0
  for (const w of angerWords) lex.anger[w] = 1.0;
  for (const w of joyWords) lex.joy[w] = 1.0;
  for (const w of sadWords) lex.sad[w] = 1.0;

  return lex;
}

// Load the lexicon from a JSON file (Vite: put emotion_words.json in /public)
async function loadLexicon() {
  try {
    const url = `${import.meta.env.BASE_URL}emotion_words.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lexicon fetch failed: ${res.status}`);

    const data = await res.json();

    LEXICON = normalizeLexiconKeys(data);
    CACHED_PHRASES = extractPhrases(LEXICON);

    console.log("Loaded lexicon from JSON:", LEXICON);
  } catch (err) {
    LEXICON = buildFallbackLexicon();
    CACHED_PHRASES = extractPhrases(LEXICON);
    console.warn("Lexicon JSON not found / failed to load. Using fallback lexicon.", err);
  }
}


// Start loading immediately
loadLexicon();

/* -------------------------------------------------------------------------- */
/*  B) Context rules: negation + intensifiers + "but" weighting + phrases       */
/* -------------------------------------------------------------------------- */

// Negations reduce/flip the emotion signal for the nearby emotion word/phrase
const NEGATIONS = new Set(["not", "no", "never", "dont", "can't", "cant", "won't", "wont", "didn't", "didnt", "isn't", "isnt", "aren't", "arent"]);

// Intensifiers make the next emotion word stronger
const INTENSIFIERS = new Map([
  ["very", 1.6],
  ["really", 1.4],
  ["so", 1.3],
  ["extremely", 2.0],
  ["super", 1.6],
  ["incredibly", 2.0],
  ["insanely", 2.0]
]);

// Diminishers make the next emotion word weaker
const DIMINISHERS = new Map([
  ["kinda", 0.55],
  ["kindof", 0.55],
  ["sorta", 0.60],
  ["somewhat", 0.65],
  ["slightly", 0.60],
  ["little", 0.50],
  ["a", 1.0], // (placeholder so we dont accidentally treat "a" as a diminisher)
  ["a little", 0.50],
  ["a bit", 0.55], 
  ["a little bit", 0.45],
  ["kind of", 0.55],
  ["sort of", 0.60],
  ["not that", 0.60],
  ["a touch", 0.55],
  ["a tad", 0.55]
]);

// Normalization makes the dictionary work on REAL writing:
// - contractions: can't -> cant, i'm -> im
// - punctuation: stripped by regex already, but we standardize apostrophes
// - simple suffix trimming: happier -> happy, excited -> excite, tired -> tire (kept conservative)
function normalizeToken(raw) {
  if (!raw) return "";

  let w = raw.toLowerCase().replace("’", "'");

  // Normalize common contractions
  // NOTE: We keep this small and predictable, not full NLP.
  if (w === "i'm" || w === "im") w = "im";
  if (w === "can't" || w === "cant") w = "cant";
  if (w === "won't" || w === "wont") w = "wont";
  if (w === "don't" || w === "dont") w = "dont";
  if (w === "didn't" || w === "didnt") w = "didnt";
  if (w === "isn't" || w === "isnt") w = "isnt";
  if (w === "aren't" || w === "arent") w = "arent";

  // Simple suffix trimming to catch variants (happier/happiest/happiness/excited/exciting)
  // We only trim when the word is long enough to avoid breaking short words.
  const original = w;

  // Plurals
  if (w.length >= 5 && w.endsWith("s") && !w.endsWith("ss")) {
    w = w.slice(0, -1);
  }

  // -ly
  if (w.length >= 6 && w.endsWith("ly")) {
    w = w.slice(0, -2);
  }

  // -ness
  if (w.length >= 7 && w.endsWith("ness")) {
    w = w.slice(0, -4);
  }

  // -ing
  if (w.length >= 7 && w.endsWith("ing")) {
    w = w.slice(0, -3);
  }

  // -ed
  if (w.length >= 6 && w.endsWith("ed")) {
    w = w.slice(0, -2);
  }

  // -er / -est
  if (w.length >= 6 && w.endsWith("est")) {
    w = w.slice(0, -3);
  } else if (w.length >= 6 && w.endsWith("er")) {
    w = w.slice(0, -2);
  }

  // If trimming made it empty or weird, fall back to original
  if (w.length < 2) return original;

  return w;
}

// Turns a sentence into a clean list of words (no punctuation)
function tokenize(text) {
  const raw = text.toLowerCase().match(/[a-z']+/g) || [];
  return raw.map((w) => normalizeToken(w));
}

// Builds a list of multi-word phrases from the lexicon ("fed up", "burned out", etc.)
function extractPhrases(lexicon) {
  const phrases = [];

  for (const emotion of Object.keys(lexicon)) {
    for (const key of Object.keys(lexicon[emotion])) {
      if (key.includes(" ")) {
        // Normalize phrase parts as well so "can't wait" works even if user types cant
        const phraseNormalized = key
          .split(" ")
          .map((p) => normalizeToken(p))
          .join(" ");

        phrases.push({
          phrase: phraseNormalized,
          emotion,
          weight: lexicon[emotion][key]
        });
      }
    }
  }

  // longest phrases first so we match bigger phrases before smaller ones
  phrases.sort((a, b) => b.phrase.split(" ").length - a.phrase.split(" ").length);

  return phrases;
}


function getPostDiminisher(words, i) {
  const next  = words[i + 1] || "";
  const next2 = words[i + 2] || "";
  const next3 = words[i + 3] || "";
  const next4 = words[i + 4] || "";

  const after2 = `${next} ${next2}`.trim();
  const after3 = `${next} ${next2} ${next3}`.trim();
  const after4 = `${next} ${next2} ${next3} ${next4}`.trim();

  return (
    DIMINISHERS.get(after4) ??
    DIMINISHERS.get(after3) ??
    DIMINISHERS.get(after2) ??
    DIMINISHERS.get(next) ??
    1.0
  );
}


// Returns scores for anger/joy/sad using:
// - weighted word matches
// - phrase matches
// - negation handling
// - intensifier/diminisher handling
// - "but/however/though" contrast boost (words after "but" become more important)
function scoreTextWithContext(text, lexicon, phrases) {
  const words = tokenize(text);
  const totalWords = words.length;

  if (!lexicon || totalWords === 0) {
    return { anger: 0, joy: 0, sad: 0, hits: 0, totalWords };
  }

  // "but" weighting: words after "but/however/though" get stronger weight
  const contrastIdx = words.findIndex((w) => w === "but" || w === "however" || w === "though");
  const contrastBoost = 1.6;

  // Mark tokens as "used" when a phrase consumes them
  const used = new Array(words.length).fill(false);

  let scores = { anger: 0, joy: 0, sad: 0 };
  let hits = 0;

  // Phrase matching + word matching
  for (let i = 0; i < words.length; i++) {
    if (used[i]) continue;

    // Attempt phrase match starting at i
    let matched = null;

    for (const p of phrases) {
      const parts = p.phrase.split(" ");
      let ok = true;

      for (let k = 0; k < parts.length; k++) {
        if (words[i + k] !== parts[k]) {
          ok = false;
          break;
        }
      }

      if (ok) {
        matched = { ...p, len: parts.length, idx: i };
        break;
      }
    }

    // If phrase matched, apply it and skip its words
    if (matched) {
      for (let k = 0; k < matched.len; k++) used[i + k] = true;

      // Look back 1-2 words for modifiers
      const prev = words[i - 1] || "";
      const prev2 = words[i - 2] || "";

      const isNegated = NEGATIONS.has(prev) || NEGATIONS.has(prev2);
      const intensity = INTENSIFIERS.get(prev) ?? INTENSIFIERS.get(prev2) ?? 1.0;
      const soften = DIMINISHERS.get(prev) ?? DIMINISHERS.get(prev2) ?? 1.0;

      let w = matched.weight * intensity * soften;

      // words after "but" matter more
      if (contrastIdx !== -1 && i > contrastIdx) w *= contrastBoost;

      // negation reduces instead of adds (simple + stable behavior)
      if (isNegated) w *= -0.8;

      scores[matched.emotion] += w;
      hits += 1;
      continue;
    }

    // Single-word match
    const word = words[i];

    for (const emotion of Object.keys(lexicon)) {
      const weightFromLexicon = lexicon[emotion][word];

      if (weightFromLexicon != null) {
        const prev = words[i - 1] || "";
        const prev2 = words[i - 2] || "";

        const isNegated = NEGATIONS.has(prev) || NEGATIONS.has(prev2);
        const intensity = INTENSIFIERS.get(prev) ?? INTENSIFIERS.get(prev2) ?? 1.0;
        const soften = DIMINISHERS.get(prev) ?? DIMINISHERS.get(prev2) ?? 1.0;

        let w = weightFromLexicon * intensity * soften;

        if (contrastIdx !== -1 && i > contrastIdx) w *= contrastBoost;
        if (isNegated) w *= -0.8;

        scores[emotion] += w;
        hits += 1;
      }
    }
  }

  return { ...scores, hits, totalWords };
}

/* -------------------------------------------------------------------------- */
/*  Event Listener: read textbox -> compute targets (A + B)                     */
/* -------------------------------------------------------------------------- */

userTextInput.addEventListener("input", (event) => {
  userText = event.target.value;

  // Spike typingEnergy on each input so blob moves even for neutral text
  typingEnergy = clamp(typingEnergy + 0.35, 0.0, 1.0);
  lastTypedAt = performance.now();

  // Score text with context rules using our lexicon (JSON or fallback)
  const { anger, joy, sad, hits, totalWords } = scoreTextWithContext(userText, LEXICON, CACHED_PHRASES);

  // If user hasn't typed any words, go neutral
  if (totalWords === 0) {
    targetSpeed = BASE_SPEED;
    targetAmplitude = BASE_AMP;
    return;
  }

  // Convert scores to positive contributions (negations reduce signal)
  const a = Math.max(0, anger);
  const j = Math.max(0, joy);
  const s = Math.max(0, sad);

  const sum = a + j + s;

  // Option A: emotion density -> drama multiplier
  // Emotion density = how many emotion hits occurred relative to all words in the textbox
  const emotionDensity = hits / totalWords; // 0..1

  // Tune this number for more/less dramatic movement:
  // 12 = medium dramatic, 18 = very dramatic, 24 = extreme
  const drama = 1 + emotionDensity * 12;

  // Typing baseline boost: blob responds even when no emotion matches are found
  // NOTE: This is NOT "energy words" - its simply "you are typing -> blob has life"
  // textLengthBoost makes longer text slightly more active
  const textLengthBoost = clamp(totalWords / 40, 0.0, 1.0); // 0..1
  const baselineBoost = 0.25 + typingEnergy * 0.9 + textLengthBoost * 0.25;

  // If nothing emotional detected, still let it move based on typing baseline
  if (sum === 0) {
    targetSpeed = clamp(BASE_SPEED + baselineBoost * 0.8, 0.2, 6.0);
    targetAmplitude = clamp(BASE_AMP + baselineBoost * 0.6, 0.05, 5.0);

    dbgAngerPct = 0.0;
    dbgJoyPct = 0.0;
    dbgSadPct = 0.0;
    dbgDrama = 0.0;
    dbgHits = hits;
    dbgTotalWords = totalWords;
    dbgBaselineBoost = baselineBoost;

    return;
  }

  // Percent of emotion signal (this keeps all emotions contributing at once)
  const angerPct = a / sum;
  const joyPct = j / sum;
  const sadPct = s / sum;

  dbgAngerPct = angerPct;
  dbgJoyPct = joyPct;
  dbgSadPct = sadPct;
  dbgDrama = drama;
  dbgHits = hits;
  dbgTotalWords = totalWords;
  dbgBaselineBoost = baselineBoost;


  // Use percentages to push targets (amplified by drama)
  targetSpeed =
    BASE_SPEED +
    angerPct * ANGER_SPEED_BOOST * drama +
    joyPct * JOY_SPEED_BOOST * drama -
    sadPct * SAD_SPEED_DROP * drama;

  targetAmplitude =
    BASE_AMP +
    angerPct * ANGER_AMP_BOOST * drama +
    joyPct * JOY_AMP_BOOST * drama -
    sadPct * SAD_AMP_DROP * drama;

  // Add a small baseline so it never feels dead even when emotions are light
  targetSpeed += baselineBoost * 0.35;
  targetAmplitude += baselineBoost * 0.25;

  // Safety clamps (avoid freezing or going insane)
  // If you want more dramatic changes, bump the max values a bit.
  targetSpeed = clamp(targetSpeed, 0.2, 6.0);
  targetAmplitude = clamp(targetAmplitude, 0.05, 5.0);

  // Debug (optional): See what the system is detecting
  // console.log({ angerPct, joyPct, sadPct, hits, totalWords, drama, baselineBoost, targetSpeed, targetAmplitude });
});

/* -------------------------------------------------------------------------- */
/*  5.) Repeatedly draw world from camera onto the canvas                       */
/* -------------------------------------------------------------------------- */

// Render loop that draws every frame
function animate() {
  // time always updates first
  uniforms.u_time.value = clock.getElapsedTime();

  // Typing energy decay (slow fade back to calm)
  // NOTE: This makes the blob settle if user stops typing
  typingEnergy = lerp(typingEnergy, 0.0, 0.03);

  // Actually changing/updating the RGB values
  // Make red pulse between 0 and 1, keep green 0.3 and blue 0.6
  // r = (Math.sin(uniforms.u_time.value) * 0.5) + 0.5;
  // g = 0.3;
  // b = 0.6;


  // setting target based on current emotion percentages
  const MIN = 0.12;

  targetR = Math.max(MIN, dbgAngerPct);
  targetG = Math.max(MIN, dbgJoyPct);
  targetB = Math.max(MIN, dbgSadPct);

  // Lerping current percentage values do the target
  currentR += (targetR - currentR) * COLOR_LERP;
  currentG += (targetG - currentG) * COLOR_LERP;
  currentB += (targetB - currentB) * COLOR_LERP;

  // Emotion based coloring:
  r = currentR;
  g = currentG;
  b = currentB;

  // Smooth transition towards target values
  speed = lerp(speed, targetSpeed, smooth);
  amplitude = lerp(amplitude, targetAmplitude, smooth);

    // Update debug UI each frame
  // COMMENTED OUT - debug panel disabled for cleaner UI
  /*
  debugPanel.innerHTML = `
    <div><b>Emotion Mix</b></div>
    <div>Anger: ${(dbgAngerPct * 100).toFixed(1)}%</div>
    <div>Joy:   ${(dbgJoyPct * 100).toFixed(1)}%</div>
    <div>Sad:   ${(dbgSadPct * 100).toFixed(1)}%</div>
    <div style="margin-top:8px;"><b>Signals</b></div>
    <div>hits/words: ${dbgHits}/${dbgTotalWords}</div>
    <div>drama: ${dbgDrama.toFixed(2)}</div>
    <div>baseline: ${dbgBaselineBoost.toFixed(2)}</div>
    <div style="margin-top:8px;"><b>Blob Params</b></div>
    <div>targetSpeed: ${targetSpeed.toFixed(3)}</div>
    <div>speed(now):  ${speed.toFixed(3)}</div>
    <div>targetAmp:   ${targetAmplitude.toFixed(3)}</div>
    <div>amp(now):    ${amplitude.toFixed(3)}</div>
  `;
  */


  // Adding uniform RGB values to be updated every frame
  uniforms.u_r.value = r;
  uniforms.u_g.value = g;
  uniforms.u_b.value = b;

  // Adding uniform speed and amplitude values to be updated every frame:
  uniforms.u_speed.value = speed;
  uniforms.u_amplitude.value = amplitude;

  renderer.render(scene, camera);
}

// Tells the renderer to call animate repeatedly (~60times/sec)
renderer.setAnimationLoop(animate);

// Rendering Flow:
// You make a Mesh (shape + look) → put it in the Scene →
// Camera defines viewpoint of the scene →
// Renderer turns scene and camera into pixels →
// renderer places pixels onto Canvas → you see it on the page.
//
// Code flow:
// renderer → scene → camera → mesh → loop
// renderer: Creates the canvas, without one nothing can appear
// scene: Need a container to hold object
// camera: Need a viewpoint of how the scene is rendered
// Mesh: The actual object/shape what we want to see
// loop: Repeatedly tells the renderer to draw the scene from the camera each frame
