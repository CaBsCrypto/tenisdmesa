import * as THREE from "three";
import { GLTFLoader } from "../assets/vendor/GLTFLoader.js";
import { HudUI } from "./hud_ui.js";
import * as MotionControls from "./motion_controls.js";
import * as AudioEngineModule from "./audio_engine.js";
import { RacketKinematicsController } from "./racket_kinematics.js";
import {
  upgradeMiiCharacterMaterials,
  updateCharacterContactShadow
} from "./mii_model_overhaul.js";
import { MiiBodyAnimator } from "./mii_body_animation.js";
import { MiiFacialFXController } from "./mii_facial_fx.js";
import { SwingVFXManager } from "./swing_vfx.js";
import {
  createTableTennisTable,
  createTableTennisArena,
  createTableTennisPaddle,
  createTableTennisBall,
  TT_SPECS
} from "./table_tennis_models.js";

/**
 * Official ITTF 1v1 Table Tennis Dimensions and Physical Constants
 */
const S = {
  TABLE_SURFACE_Y: TT_SPECS.TABLE_HEIGHT, // 0.76m
  TABLE_HALF_L: TT_SPECS.TABLE_LENGTH / 2, // 1.37m (Z: -1.37 to +1.37)
  TABLE_HALF_W: TT_SPECS.TABLE_WIDTH / 2,  // 0.7625m (X: -0.7625 to +0.7625)
  NET_TOP_Y: TT_SPECS.TABLE_HEIGHT + TT_SPECS.NET_HEIGHT, // 0.9125m
  NET_POST_X: TT_SPECS.TABLE_WIDTH / 2 + TT_SPECS.NET_OVERHANG, // 0.915m
  BASELINE_Z: TT_SPECS.PLAYER_BASE_Z, // 2.15m
  OPPONENT_Z: TT_SPECS.OPPONENT_BASE_Z, // -2.15m
  MAX_RALLY_Z: 3.5,
  MAX_RALLY_X: 1.6
};

const L = {
  FIXED_DT: 1 / 120,
  GRAVITY: 9.8,
  AIR_DRAG: 0.016,
  BOUNCE_RESTITUTION: 0.89,
  SURFACE_FRICTION: 0.84
};

/**
 * Procedural Ball Trail Ribbon for high-speed Ping Pong ball visualization
 */
class TableTennisBallTrail {
  constructor(scene, maxPoints = 40) {
    this.scene = scene;
    this.maxPoints = maxPoints;
    this.points = [];
    this.color = new THREE.Color(0xffffff);
    this.accentColor = new THREE.Color(0xffaa22);
    this.baseWidth = 0.08;

    const count = maxPoints * 2;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 4);
    const indices = [];
    for (let s = 0; s < maxPoints - 1; s++) {
      const n = s * 2, h = n + 1, r = n + 2, l = n + 3;
      indices.push(n, h, r, h, l, r);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setIndex(indices);
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.scene.add(this.mesh);
  }

  setStyle(shot = "TOPSPIN", isPower = false) {
    const s = String(shot || "TOPSPIN").toUpperCase();
    if (isPower || s === "SMASH") {
      this.color.setHex(0xffffff);
      this.accentColor.setHex(0xff3322);
      this.baseWidth = 0.095;
    } else if (s === "SLICE" || s === "BACKSPIN") {
      this.color.setHex(0xffffff);
      this.accentColor.setHex(0x44bbff);
      this.baseWidth = 0.08;
    } else {
      this.color.setHex(0xffffff);
      this.accentColor.setHex(0xffcc00);
      this.baseWidth = 0.08;
    }
  }

  clear() {
    this.points.length = 0;
    this.mesh.visible = false;
  }

  pushPoint(pt) {
    this.points.unshift(pt.clone());
    if (this.points.length > this.maxPoints) this.points.pop();
  }

  seedArc(fromPt, toPt, arcHeight = 0.25) {
    this.points.length = 0;
    for (let a = 0; a < this.maxPoints; a++) {
      const n = 1 - a / (this.maxPoints - 1);
      const h = new THREE.Vector3().lerpVectors(fromPt, toPt, n);
      h.y += Math.sin(n * Math.PI) * arcHeight;
      this.points.push(h);
    }
    this.mesh.visible = true;
  }

  updateGeometry(camera) {
    const total = this.points.length;
    if (total < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const camPos = camera.position;
    const tangent = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const c = new THREE.Color();

    for (let r = 0; r < this.maxPoints; r++) {
      const idx = Math.min(r, total - 1);
      const p = this.points[idx];
      const nextIdx = Math.min(idx + 1, total - 1);
      const prevIdx = Math.max(idx - 1, 0);

      tangent.subVectors(this.points[prevIdx], this.points[nextIdx]);
      if (tangent.lengthSq() < 1e-6) tangent.set(0, 0, 1);
      else tangent.normalize();

      camDir.subVectors(camPos, p).normalize();
      normal.crossVectors(tangent, camDir).normalize();
      if (normal.lengthSq() < 1e-4) normal.set(1, 0, 0);

      const y = 1 - idx / Math.max(1, total - 1);
      const halfWidth = this.baseWidth * (0.2 + 0.8 * Math.pow(y, 0.65)) * 0.5;
      const alpha = Math.pow(y, 0.9) * 0.92;
      c.copy(this.color).lerp(this.accentColor, (1 - y) * 0.7);

      const d = r * 2;
      const b = d + 1;

      this.positions[d * 3 + 0] = p.x + normal.x * halfWidth;
      this.positions[d * 3 + 1] = p.y + normal.y * halfWidth;
      this.positions[d * 3 + 2] = p.z + normal.z * halfWidth;

      this.positions[b * 3 + 0] = p.x - normal.x * halfWidth;
      this.positions[b * 3 + 1] = p.y - normal.y * halfWidth;
      this.positions[b * 3 + 2] = p.z - normal.z * halfWidth;

      this.colors[d * 4 + 0] = c.r;
      this.colors[d * 4 + 1] = c.g;
      this.colors[d * 4 + 2] = c.b;
      this.colors[d * 4 + 3] = alpha;

      this.colors[b * 4 + 0] = c.r;
      this.colors[b * 4 + 1] = c.g;
      this.colors[b * 4 + 2] = c.b;
      this.colors[b * 4 + 3] = alpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

function createRadialShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, "rgba(8, 18, 28, 0.82)");
  grad.addColorStop(0.55, "rgba(8, 18, 28, 0.42)");
  grad.addColorStop(1, "rgba(8, 18, 28, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export class ArgonTennisEngine {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.urlState = (this.params.get("state") || "").toLowerCase();
    this.urlRoom = (this.params.get("room") || "").trim().toUpperCase();
    this.urlRole = (this.params.get("role") || "p1").trim().toLowerCase() === "p2" ? "p2" : "p1";
    this.urlMode = (this.params.get("mode") || this.params.get("difficulty") || "").toLowerCase();
    this.urlAutoPlay = this.params.has("play") || !!this.urlState;

    this.roomId = this.urlRoom || "default";
    this.playerRole = this.urlRole;
    this.isMultiplayer = !!(this.urlRoom && this.urlRoom !== "DEFAULT") || this.urlMode === "1v1";
    this.roomStatus = {
      roomId: this.roomId,
      p1Online: true,
      p2Online: false,
      p1Phone: false,
      p2Phone: false,
      tunnelUrl: "",
      urls: null
    };

    this.lastAppliedSnapshotSeq = 0;
    this.lastSyncSentAt = 0;
    this.bannerSeq = 0;
    this.lastBannerBroadcast = null;

    // Renderer & Canvas Setup
    this.canvas = document.getElementById("game-canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x132235);
    this.scene.fog = new THREE.FogExp2(0x132235, 0.015);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.05, 120);
    this.cameraMode = "RALLY_CAM";
    this.manualCameraOverride = null;
    this.cameraPosSmooth = new THREE.Vector3(0, 1.82, 3.8);
    this.cameraLookSmooth = new THREE.Vector3(0, 0.84, -0.6);
    this.cameraTrauma = 0;

    const diff = this.isMultiplayer ? "1v1" : ["casual", "pro", "1v1"].includes(this.urlMode) ? this.urlMode : "casual";
    this.matchConfig = {
      gamesToWin: diff === "1v1" ? 1 : 2, // Best of 3 = 2 games to win
      inputMode: "mouse",
      difficulty: diff
    };

    // Official ITTF Table Tennis 1v1 Scoring
    this.initialServer = "player";
    this.score = {
      playerPoints: 0,
      opponentPoints: 0,
      playerGames: 0,
      opponentGames: 0,
      server: "player",
      deuceSide: true
    };

    // Detailed Match & Set Statistics Tracking
    this.matchStats = {
      playerSmashes: 0,
      opponentSmashes: 0,
      longestRally: 0,
      playerReturns: 0,
      opponentReturns: 0,
      playerTotalPoints: 0,
      opponentTotalPoints: 0,
      playerServicePoints: 0,
      opponentServicePoints: 0,
      playerMaxSpeedKmh: 0,
      opponentMaxSpeedKmh: 0,
      playerErrors: 0,
      opponentErrors: 0,
      setHistory: [],
      currentSet: {
        setNumber: 1,
        playerPoints: 0,
        opponentPoints: 0,
        playerSmashes: 0,
        opponentSmashes: 0,
        longestRally: 0,
        playerReturns: 0,
        opponentReturns: 0
      }
    };

    this.phase = "TITLE";
    this.phaseTimer = 0;
    this.selectedShotType = "TOPSPIN";
    this.p2SelectedShotType = "TOPSPIN";
    this.autoPlayMode = this.urlAutoPlay;
    this.userHasInteracted = false;
    this.persistentStateLock = false;

    this.pendingUserSwing = null;
    this.pendingP2Swing = null;
    this.pendingServeSwing = null;

    // Table Tennis Ball State
    this.ball = {
      mesh: null,
      pos: new THREE.Vector3(0.25, 0.96, S.BASELINE_Z - 0.2),
      vel: new THREE.Vector3(0, 0, 0),
      spin: new THREE.Vector3(0, 0, 0),
      inPlay: false,
      lastHitter: "player",
      bounceCountOnCurrentSide: 0,
      hasBouncedOnServerTable: false,
      shotType: "TOPSPIN",
      isPowerShot: false,
      rallyStrokeCount: 0,
      targetLanding: new THREE.Vector3(0, S.TABLE_SURFACE_Y, -0.9)
    };

    // 1v1 Singles Actors
    this.player = this._createActorState("player", 1, new THREE.Vector3(0, 0, S.BASELINE_Z));
    this.opponent = this._createActorState("opponent", -1, new THREE.Vector3(0, 0, S.OPPONENT_Z));
    this._applyDifficultyTuning(this.matchConfig.difficulty);

    this.ballTrail = new TableTennisBallTrail(this.scene, 35);
    this.bounceRings = [];
    this.starParticles = [];
    this.racketKinematics = new RacketKinematicsController();
    this.bodyAnimator = new MiiBodyAnimator();
    this.facialFX = new MiiFacialFXController(this.scene);
    this.swingVfx = new SwingVFXManager(this.scene);

    this._setupLighting();
    this._setupEffectsPools();
    this._initHudAndControllers();

    this.clock = new THREE.Clock();
    this.physicsAccumulator = 0;
    this.elapsedTime = 0;

    window.addEventListener("resize", () => this._onResize());
  }

  _createActorState(role, sideSign, initialPos) {
    const speeds = { player: 7.2, opponent: 6.4 };
    return {
      role,
      sideSign,
      root: new THREE.Group(),
      model: null,
      parts: {},
      racketPivot: new THREE.Group(),
      racketMesh: null,
      swingArcMesh: null,
      shadowBlob: null,
      pos: initialPos.clone(),
      vel: new THREE.Vector3(),
      targetPos: initialPos.clone(),
      maxSpeed: speeds[role] || 6.5,
      stridePhase: 0,
      swingTimer: 0,
      swingDuration: 0.3,
      swingCooldown: 0,
      swingType: "forehand",
      arcVisibleTimer: 0
    };
  }

  _applyDifficultyTuning(diff = "casual") {
    const d = String(diff || "casual").toLowerCase();
    this.matchConfig.difficulty = d;
    if (d === "1v1") {
      this.isMultiplayer = true;
      this.matchConfig.gamesToWin = 1;
      this.player.maxSpeed = 7.5;
      this.opponent.maxSpeed = 7.5;
    } else if (d === "pro") {
      this.isMultiplayer = !!(this.urlRoom && this.urlRoom !== "DEFAULT");
      this.player.maxSpeed = 7.5;
      this.opponent.maxSpeed = 6.6;
    } else {
      this.isMultiplayer = !!(this.urlRoom && this.urlRoom !== "DEFAULT");
      this.player.maxSpeed = 7.8;
      this.opponent.maxSpeed = 5.2;
    }
  }

  _setupLighting() {
    // Indoor competition stadium lighting
    const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x1f2c3d, 1.25);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    // Primary Table Spotlight
    this.sunLight = new THREE.DirectionalLight(0xfff8ee, 2.4);
    this.sunLight.position.set(5, 14, 6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 30;
    const r = 5.5;
    this.sunLight.shadow.camera.left = -r;
    this.sunLight.shadow.camera.right = r;
    this.sunLight.shadow.camera.top = r;
    this.sunLight.shadow.camera.bottom = -r;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    // Fill light from back
    const fillLight = new THREE.DirectionalLight(0x75a8db, 0.9);
    fillLight.position.set(-6, 12, -7);
    this.scene.add(fillLight);

    // Soft overhead floodlight
    const flood = new THREE.PointLight(0xfffdf7, 1.6, 22, 1.2);
    flood.position.set(0, 6.5, 0);
    this.scene.add(flood);

    // Contact shadows
    const shadowTex = createRadialShadowTexture();
    const createShadow = (scale, opacity) => {
      const geo = new THREE.PlaneGeometry(scale * 2, scale * 2);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.005;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      return mesh;
    };

    this.player.shadowBlob = createShadow(0.48, 0.85);
    this.opponent.shadowBlob = createShadow(0.48, 0.85);
    this.ballShadowBlob = createShadow(0.12, 0.9);
  }

  _setupEffectsPools() {
    for (let t = 0; t < 6; t++) {
      const geo = new THREE.RingGeometry(0.04, 0.12, 24);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.position.y = S.TABLE_SURFACE_Y + 0.002;
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.bounceRings.push({ mesh, age: 0, active: false });
    }

    const starGeo = new THREE.OctahedronGeometry(0.045, 0);
    for (let t = 0; t < 24; t++) {
      const mat = new THREE.MeshBasicMaterial({
        color: t % 2 === 0 ? 0xffea28 : 0x5ce6ff,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(starGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 8;
      this.scene.add(mesh);
      this.starParticles.push({
        mesh,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.35,
        active: false
      });
    }
  }

  _initHudAndControllers() {
    this.hud = new HudUI({
      onSelectMatchLength: games => {
        this.matchConfig.gamesToWin = games;
      },
      onSelectDifficulty: diff => {
        this._applyDifficultyTuning(diff);
        if (diff === "1v1" && (!this.roomId || this.roomId === "default")) {
          this.createMultiplayerRoom();
        }
      },
      onCreateMultiplayerRoom: async (params = {}) => await this.createMultiplayerRoom(params),
      onSelectInputMode: mode => {
        this.matchConfig.inputMode = mode;
        if (mode === "webcam" && this.motionController) {
          this.motionController.enableWebcam();
        }
      },
      onStartMatch: ({ gamesToWin, inputMode, difficulty }) => {
        this.matchConfig.gamesToWin = gamesToWin;
        this.matchConfig.inputMode = inputMode;
        if (difficulty) this._applyDifficultyTuning(difficulty);
        this.autoPlayMode = false;
        this.userHasInteracted = true;
        this.persistentStateLock = false;
        if (inputMode === "webcam" && this.motionController) {
          this.motionController.enableWebcam();
        }
        this.startNewMatch({ showStartBanner: true });
      },
      onSelectShotType: type => {
        if (this.playerRole === "p2") this.p2SelectedShotType = type;
        else this.selectedShotType = type;
        if (this.motionController && this.motionController.setShotType) {
          this.motionController.setShotType(type.toLowerCase());
        }
      },
      onToggleAudio: () => {
        if (this.audioEngine) {
          const muted = this.audioEngine.toggleMute();
          const info = this.audioEngine.getCurrentTrackInfo();
          this.hud.updateAudioStatus({ playing: !muted, trackName: info.title });
        }
      },
      onCycleCamera: () => {
        const cams = [null, "RALLY_CAM", "SERVE_CAM", "REPLAY_CAM", "INTRO_PAN"];
        const curIdx = cams.indexOf(this.manualCameraOverride);
        this.manualCameraOverride = cams[(curIdx + 1) % cams.length];
        const labels = {
          null: "Auto",
          RALLY_CAM: "Mesa Pro",
          SERVE_CAM: "Saque",
          REPLAY_CAM: "Red Lateral",
          INTRO_PAN: "Estadio"
        };
        this.hud.updateCameraLabel(labels[this.manualCameraOverride] || "Auto");
        this.hud.setReplayMode(this.manualCameraOverride === "REPLAY_CAM");
      },
      onToggleReplay: () => {
        if (this.phase === "REPLAY") {
          this.persistentStateLock = false;
          this.hud.setReplayMode(false);
          this._setupPointServe({ showBanner: false });
        } else {
          this._enterInstantReplayState({ persistent: false });
        }
      },
      onToggleWebcam: async () => {
        if (this.motionController) {
          this.autoPlayMode = false;
          this.userHasInteracted = true;
          this.persistentStateLock = false;
          if (this.motionController.webcamActive) {
            this.motionController.disableWebcam && this.motionController.disableWebcam();
            this.hud.updateMotionStatus({
              webcamActive: false,
              phoneConnected: this.motionController.phoneState?.connected
            });
          } else {
            const active = await this.motionController.enableWebcam();
            this.hud.updateMotionStatus({
              webcamActive: active,
              phoneConnected: this.motionController.phoneState?.connected
            });
            if (this.phase === "TITLE") {
              this.hud.hideTitleModal();
              this.startNewMatch({ showStartBanner: true });
            }
          }
        }
      },
      onPlayAgain: () => {
        this.autoPlayMode = false;
        this.userHasInteracted = true;
        this.persistentStateLock = false;
        this.startNewMatch({ showStartBanner: true });
      }
    });

    const AudioEngineClass = AudioEngineModule.AudioEngine || AudioEngineModule.default;
    if (AudioEngineClass) {
      this.audioEngine = new AudioEngineClass({
        onTrackChange: track => {
          this.hud.updateAudioStatus({
            playing: !track.muted,
            trackName: track.title.replace(/\s*\(Lyria 3\)/i, "")
          });
        }
      });
    }

    const MotionClass = MotionControls.MotionController || MotionControls.default;
    if (MotionClass) {
      this.motionController = new MotionClass({
        webcamCanvasId: "webcam-canvas",
        roomId: this.roomId,
        role: this.playerRole,
        onSwing: e => this._handleUserSwingInput(e),
        onToss: e => this._handleUserTossInput(e),
        onP2Swing: e => this._handleP2SwingInput(e),
        onP2Toss: e => this._handleP2TossInput(e),
        onRoomState: s => this._handleRoomStateUpdate(s),
        onStatusChange: s => {
          this.hud.updateMotionStatus({
            webcamActive: !!s.webcam,
            phoneConnected: !!s.phone,
            p1Phone: !!s.p1Phone,
            p2Phone: !!s.p2Phone
          });
        }
      });
    }

    // Keyboard bindings (Arrow keys/WASD movement, Space/Click to swing)
    this.keys = {};
    window.addEventListener("keydown", e => {
      this.keys[e.code] = true;
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (window.__matchStatsOverlay && window.__matchStatsOverlay.isVisible) {
        if (e.code === "KeyM") this.hud.callbacks.onToggleAudio();
        return;
      }
      if (e.code === "KeyC") this.hud.callbacks.onCycleCamera();
      else if (e.code === "KeyR") this.hud.callbacks.onToggleReplay();
      else if (e.code === "KeyM") this.hud.callbacks.onToggleAudio();
      else if (e.code === "Space") {
        e.preventDefault();
        if (this.phase === "SERVE_STANCE") {
          this._handleUserTossInput();
        } else {
          this._handleUserSwingInput({ source: "keyboard", shotType: this.selectedShotType, speed: 1.25 });
        }
      } else if (this.isMultiplayer && (e.code === "ShiftRight" || e.code === "KeyK" || e.code === "Numpad0")) {
        this._handleP2SwingInput({ source: "keyboard_p2", shotType: this.p2SelectedShotType, speed: 1.22 });
      }
    });

    window.addEventListener("keyup", e => {
      this.keys[e.code] = false;
    });

    // Mouse pointer controls for table tennis paddle movement
    window.addEventListener("pointermove", e => {
      if (this.phase === "RALLY" || this.phase === "SERVE_STANCE") {
        const normX = (e.clientX / window.innerWidth) * 2 - 1;
        const targetX = THREE.MathUtils.clamp(normX * 1.15, -S.TABLE_HALF_W - 0.25, S.TABLE_HALF_W + 0.25);
        this.player.targetPos.x = targetX;
      }
    });

    window.addEventListener("pointerdown", e => {
      if (e.target && (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT" || e.target.closest("#rules-modal") || e.target.closest("#title-modal") || e.target.closest("#companion-modal") || e.target.closest("#victory-modal") || e.target.closest("#match-stats-modal"))) {
        return;
      }
      if (window.__matchStatsOverlay && window.__matchStatsOverlay.isVisible) {
        return;
      }
      if (this.phase === "SERVE_STANCE") {
        this._handleUserTossInput();
      } else if (this.phase === "SERVE_TOSS") {
        this._handleUserSwingInput({ source: "pointer", shotType: this.selectedShotType, speed: 1.25 });
      } else if (this.phase === "RALLY") {
        this._handleUserSwingInput({ source: "pointer", shotType: this.selectedShotType, speed: 1.25 });
      }
    });
  }

  async createMultiplayerRoom({ p1Name = "Player 1", p2Name = "Player 2" } = {}) {
    try {
      const resp = await fetch("/api/match/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p1Name, p2Name })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.roomId) {
          this.roomId = data.roomId;
          this.isMultiplayer = true;
          this._applyDifficultyTuning("1v1");
          if (this.motionController && this.motionController.setRoomConfig) {
            this.motionController.setRoomConfig({ roomId: this.roomId, role: this.playerRole });
          }
          this.roomStatus = {
            ...this.roomStatus,
            roomId: data.roomId,
            tunnelUrl: data.tunnelUrl || "",
            urls: data.urls || null
          };
          this.hud && this.hud.updateMultiplayerRoomInfo && this.hud.updateMultiplayerRoomInfo(this.roomStatus);
          return data;
        }
      }
    } catch (err) {
      console.warn("[TableTennisEngine] Failed to create 1v1 room:", err);
    }
    return null;
  }

  async loadAssetsAndStart() {
    const loader = new GLTFLoader();
    const loadGltf = async (url) => {
      try {
        const gltf = await new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        return gltf.scene;
      } catch (err) {
        console.warn(`[TableTennisEngine] Could not load ${url}, using fallback:`, err);
        return new THREE.Group();
      }
    };

    // Load Mii characters and crowd
    const [miiPlayerScene, miiOpponentScene, crowdScene] = await Promise.all([
      loadGltf("https://www.gstatic.com/aistudio/starter-apps/tennis/models/mii_player.glb?v=argon4_kinetic"),
      loadGltf("https://www.gstatic.com/aistudio/starter-apps/tennis/models/mii_opponent.glb?v=argon4_kinetic"),
      loadGltf("https://www.gstatic.com/aistudio/starter-apps/tennis/models/mii_crowd.glb?v=argon4_kinetic")
    ]);

    // 1. Build authentic ITTF Table Tennis Table & Arena
    this.tableTennisTable = createTableTennisTable();
    this.scene.add(this.tableTennisTable);

    this.tableTennisArena = createTableTennisArena();
    this.scene.add(this.tableTennisArena);

    // 2. Setup Crowd in background
    if (crowdScene) {
      crowdScene.position.set(0, 0, -3.5);
      crowdScene.scale.setScalar(0.75);
      this.crowdScene = crowdScene;
      this.scene.add(crowdScene);
    }

    // 3. Prepare 1v1 Mii Actors with Table Tennis Paddles
    this._prepareMiiTableTennisActor(this.player, miiPlayerScene, "p1");
    this._prepareMiiTableTennisActor(this.opponent, miiOpponentScene, "p2");

    // 4. Prepare Table Tennis Ball
    this.ball.mesh = createTableTennisBall();
    this.ball.mesh.position.copy(this.ball.pos);
    this.scene.add(this.ball.mesh);

    this._bootInitialStateFromURL();
    this.clock.start();

    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.08);
      this.update(dt);
      this.render();
    };
    requestAnimationFrame(loop);
  }

  _prepareMiiTableTennisActor(actor, gltfScene, roleKey) {
    actor.model = gltfScene;
    gltfScene.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.userData.basePos = node.position.clone();
        node.userData.baseRot = node.rotation.clone();
      }
      const name = (node.name || "").trim();
      if (/^head/i.test(name) && !actor.parts.head) actor.parts.head = node;
      else if (/^torso/i.test(name) && !actor.parts.torso) actor.parts.torso = node;
      else if (/^hand_l/i.test(name) && !actor.parts.handL) actor.parts.handL = node;
      else if (/^hand_r/i.test(name) && !actor.parts.handR) actor.parts.handR = node;
      else if (/^foot_l/i.test(name) && !actor.parts.footL) actor.parts.footL = node;
      else if (/^foot_r/i.test(name) && !actor.parts.footR) actor.parts.footR = node;
    });

    gltfScene.scale.setScalar(0.92);
    actor.root.add(gltfScene);

    upgradeMiiCharacterMaterials(actor, roleKey);
    this.facialFX && this.facialFX.attachFacialRig(actor);
    this.bodyAnimator && this.bodyAnimator.setupArticulatedMiiRig(actor);

    // Attach Official Table Tennis Bat (Pala de Ping Pong)
    const paddle = createTableTennisPaddle();
    actor.racketMesh = paddle;
    actor.racketPivot.position.set(-0.24, 0.82, 0.22);
    actor.racketPivot.add(paddle);
    actor.root.add(actor.racketPivot);

    actor.root.rotation.y = actor.sideSign > 0 ? Math.PI : 0;
    actor.root.position.copy(actor.pos);
    this.scene.add(actor.root);

    this.racketKinematics && this.racketKinematics.initActor(actor);
    this.swingVfx && this.swingVfx.registerActor(actor);
  }

  _bootInitialStateFromURL() {
    this._syncScoreboardHUD();
    if (!this.urlAutoPlay) {
      this.score.playerPoints = 0;
      this.score.opponentPoints = 0;
      this._syncScoreboardHUD();
      this.autoPlayMode = true;
      this.audioEngine && this.audioEngine.playMusicForState("title");
      this._setupPointServe({ showBanner: false });
      return;
    }

    this.hud.hideTitleModal();
    this.autoPlayMode = false;
    this.persistentStateLock = false;
    this.startNewMatch({ showStartBanner: true });
    this._snapCameraImmediate();
  }

  startNewMatch({ showStartBanner = true } = {}) {
    this.score.playerPoints = 0;
    this.score.opponentPoints = 0;
    this.score.playerGames = 0;
    this.score.opponentGames = 0;
    this.initialServer = "player";
    this.score.server = "player";
    this.score.deuceSide = true;

    // Reset statistics for fresh match
    this.matchStats = {
      playerSmashes: 0,
      opponentSmashes: 0,
      longestRally: 0,
      playerReturns: 0,
      opponentReturns: 0,
      playerTotalPoints: 0,
      opponentTotalPoints: 0,
      playerServicePoints: 0,
      opponentServicePoints: 0,
      playerMaxSpeedKmh: 0,
      opponentMaxSpeedKmh: 0,
      playerErrors: 0,
      opponentErrors: 0,
      setHistory: [],
      currentSet: {
        setNumber: 1,
        playerPoints: 0,
        opponentPoints: 0,
        playerSmashes: 0,
        opponentSmashes: 0,
        longestRally: 0,
        playerReturns: 0,
        opponentReturns: 0
      }
    };

    if (window.__matchStatsOverlay) {
      window.__matchStatsOverlay.close();
    }

    this._syncScoreboardHUD();
    this.hud.setReplayMode(false);
    this.audioEngine && this.audioEngine.playMusicForState("start");
    this.audioEngine && this.audioEngine.announceScore("Start");

    this._setupPointServe({
      showBanner: showStartBanner,
      bannerText: "Start",
      bannerStyle: "style-start",
      persistentBanner: false
    });
  }

  _setupPointServe({ showBanner = true, bannerText = null, bannerStyle = "style-gold", persistentBanner = false } = {}) {
    this.phase = "SERVE_STANCE";
    this.phaseTimer = 0;
    this.cameraMode = "SERVE_CAM";
    this.hud.setReplayMode(false);
    this.ballTrail.clear();
    this.swingVfx && this.swingVfx.clearAllTrails();
    this.audioEngine && this.audioEngine.setCourtAmbientPhase && this.audioEngine.setCourtAmbientPhase("serve");

    const isPlayerServer = this.score.server === "player";
    const serveX = 0.22;

    if (isPlayerServer) {
      this.player.pos.set(serveX, 0, S.BASELINE_Z);
      this.player.targetPos.copy(this.player.pos);
      this.opponent.pos.set(-0.15, 0, S.OPPONENT_Z);
      this.opponent.targetPos.copy(this.opponent.pos);
      // Ball rests in server's free hand behind baseline
      this.ball.pos.set(serveX - 0.22, 0.94, S.BASELINE_Z - 0.15);
    } else {
      this.opponent.pos.set(-serveX, 0, S.OPPONENT_Z);
      this.opponent.targetPos.copy(this.opponent.pos);
      this.player.pos.set(0.15, 0, S.BASELINE_Z);
      this.player.targetPos.copy(this.player.pos);
      this.ball.pos.set(-serveX + 0.22, 0.94, S.OPPONENT_Z + 0.15);
    }

    this.ball.vel.set(0, 0, 0);
    this.ball.spin.set(0, 0, 0);
    this.ball.inPlay = false;
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.hasBouncedOnServerTable = false;
    this.ball.rallyStrokeCount = 0;
    this.pendingUserSwing = null;
    this.pendingP2Swing = null;
    this.pendingServeSwing = null;

    let text = bannerText;
    let style = bannerStyle;
    if (!text && showBanner) {
      const stakes = this._getHighStakesPointLabel();
      if (stakes) {
        text = stakes;
        style = "style-gold";
        this.audioEngine && this.audioEngine.announceScore(stakes, { delayMs: 180 });
      }
    }

    if (text && showBanner) {
      this._recordBannerBroadcast(text, style, "");
      this.hud.showCenterBanner(text, { style, durationMs: 1700, persistent: persistentBanner });
    } else if (!persistentBanner) {
      this.hud.hideCenterBanner();
    }

    this.hud.updateTimingGauge({
      cursorNormalized: 0.5,
      modeTitle: "SAQUE 1v1",
      speedText: "ESPACIO / CLICK PARA LANZAR BOLA"
    });
  }

  _handleUserTossInput() {
    this.userHasInteracted = true;
    if (this.phase === "TITLE") {
      this.hud.hideTitleModal();
      this.autoPlayMode = false;
      this.startNewMatch({ showStartBanner: true });
      return true;
    }
    if (this.phase === "SERVE_STANCE" && this.score.server === "player") {
      this.hud.hideCenterBanner();
      this._startServeToss(this.player);
      return true;
    }
    return false;
  }

  _handleUserSwingInput(evt = {}) {
    this.userHasInteracted = true;
    if (this.phase === "TITLE") {
      this.hud.hideTitleModal();
      this.autoPlayMode = false;
      this.startNewMatch({ showStartBanner: true });
      return;
    }
    if (this.phase === "SERVE_STANCE" && this.score.server === "player") {
      this._startServeToss(this.player);
      return;
    }
    if (this.phase === "SERVE_TOSS" && this.score.server === "player") {
      this._executeServeHit(this.player, evt);
      return;
    }
    if (this.phase === "RALLY") {
      this._attemptPlayerRallyStrike(evt);
    }
  }

  _handleP2TossInput() {
    this.userHasInteracted = true;
    this.isMultiplayer = true;
    if (this.phase === "SERVE_STANCE" && this.score.server === "opponent") {
      this.hud.hideCenterBanner();
      this._startServeToss(this.opponent);
      return true;
    }
    return false;
  }

  _handleP2SwingInput(evt = {}) {
    this.userHasInteracted = true;
    this.isMultiplayer = true;
    if (this.phase === "SERVE_STANCE" && this.score.server === "opponent") {
      this._startServeToss(this.opponent);
      return;
    }
    if (this.phase === "SERVE_TOSS" && this.score.server === "opponent") {
      this._executeServeHit(this.opponent, evt);
      return;
    }
    if (this.phase === "RALLY") {
      this._attemptP2RallyStrike(evt);
    }
  }

  _startServeToss(actor) {
    this.phase = "SERVE_TOSS";
    this.phaseTimer = 0;
    this.pendingServeSwing = null;

    // Table Tennis ITTF Toss: vertical upwards toss at least 16cm (here ~0.45m for responsive gameplay)
    const tossOffsetX = actor.sideSign > 0 ? -0.16 : 0.16;
    this.ball.pos.set(actor.pos.x + tossOffsetX, 0.98, actor.pos.z - actor.sideSign * 0.15);
    this.ball.vel.set(0, 3.2, 0);
    this.ball.inPlay = false;

    this.facialFX && this.facialFX.setExpression(actor, "focused_squint", 1.2);
    this.audioEngine && this.audioEngine.playServeToss();
  }

  _executeServeHit(actor, evt = {}) {
    if (this.ball.pos.y < 0.82) return;
    this.pendingServeSwing = null;

    actor.swingType = "serve";
    actor.swingDuration = 0.3;
    actor.swingTimer = 0.3;
    actor.arcVisibleTimer = 0.3;

    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(actor, {
        shotType: "serve",
        side: "forehand",
        speed: 1.2,
        timing: "sweet",
        isServe: true
      });
    }

    // Official Table Tennis Serve Kinematics:
    // Ball must bounce ONCE on server's table half (Z > 0 for player), then cross net, and bounce on opponent's table half (Z < 0).
    const dirX = Number(evt.dirX || 0);
    const targetOpponentX = THREE.MathUtils.clamp(dirX * 0.45 + (Math.random() - 0.5) * 0.35, -S.TABLE_HALF_W + 0.1, S.TABLE_HALF_W - 0.1);
    const targetOpponentZ = -actor.sideSign * (0.45 + Math.random() * 0.75);

    // Initial server table bounce target (halfway on server's side)
    const serverBounceZ = actor.sideSign * (0.65 + Math.random() * 0.4);
    const serverBounceX = actor.pos.x * 0.5;

    // Calculate trajectory to hit server's side first
    const flight1 = 0.22;
    const vx = (serverBounceX - this.ball.pos.x) / flight1;
    const vz = (serverBounceZ - this.ball.pos.z) / flight1;
    const vy = (S.TABLE_SURFACE_Y - this.ball.pos.y + 0.5 * L.GRAVITY * flight1 * flight1) / flight1;

    this.ball.vel.set(vx, vy, vz);
    this.ball.spin.set(12, dirX * 6, 0);
    this.ball.targetLanding.set(targetOpponentX, S.TABLE_SURFACE_Y, targetOpponentZ);

    this.ball.inPlay = true;
    this.ball.lastHitter = actor.role;
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.hasBouncedOnServerTable = false;
    this.ball.rallyStrokeCount = 1;
    this.ball.isPowerShot = false;
    this.ball.shotType = "TOPSPIN";

    this.ballTrail.clear();
    this.ballTrail.setStyle("TOPSPIN", false);
    this.ballTrail.pushPoint(this.ball.pos);

    this.phase = "RALLY";
    this.cameraMode = "RALLY_CAM";
    this.audioEngine && this.audioEngine.setCourtAmbientPhase && this.audioEngine.setCourtAmbientPhase("rally");

    this.audioEngine && this.audioEngine.playRacketHit("topspin", "good");
    this.facialFX && this.facialFX.setExpression(actor, "effort_shout", 0.6);

    const kmh = Math.round(52 + Math.random() * 18);
    this.hud.showTimingPopup({
      grade: "SAQUE VÁLIDO",
      detail: `${kmh} KM/H • EFECTO TOPSPIN`,
      screenPos: this._projectToScreen(actor.pos.clone().add(new THREE.Vector3(0, 1.6, 0)))
    });
    this.hud.updateTimingGauge({
      cursorNormalized: 0.5,
      modeTitle: "SAQUE REALIZADO",
      speedText: `${kmh} KM/H`
    });

    const receiver = actor.role === "player" ? this.opponent : this.player;
    this._predictBallIntercept(receiver);
  }

  _attemptPlayerRallyStrike(evt = {}) {
    if (this.ball.lastHitter === "player") return false;

    const diffZ = this.ball.pos.z - this.player.pos.z;
    const diffX = Math.abs(this.ball.pos.x - this.player.pos.x);
    const dist = Math.hypot(diffX, diffZ);

    // Require ball to be within reasonable reach and height
    if (dist > 1.6 || this.ball.pos.y > 1.85 || this.ball.pos.y < 0.68) return false;

    // Check volley rule: ball must have bounced on player's table side!
    if (this.ball.bounceCountOnCurrentSide < 1) {
      // Prohibited volley fault in table tennis!
      this._awardPoint("opponent", "Falta: Volea Prohibida");
      return true;
    }

    const shotType = String(evt.shotType || this.selectedShotType || "TOPSPIN").toUpperCase();
    const isSmash = shotType === "SMASH" || this.ball.pos.y > 1.25;
    const isBackhand = this.ball.pos.x < this.player.pos.x - 0.04;

    this.player.swingType = isSmash ? "smash" : isBackhand ? "backhand" : "forehand";
    this.player.swingDuration = 0.28;
    this.player.swingTimer = 0.28;

    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(this.player, {
        shotType: isSmash ? "smash" : shotType.toLowerCase(),
        side: isSmash ? "overhead" : isBackhand ? "backhand" : "forehand",
        speed: 1.3,
        timing: "sweet"
      });
    }

    // Launch ball to opponent's table half
    const dirX = Number(evt.dirX || 0);
    const targetX = THREE.MathUtils.clamp(dirX * 0.55 + (Math.random() - 0.5) * 0.4, -S.TABLE_HALF_W + 0.1, S.TABLE_HALF_W - 0.1);
    const targetZ = -(0.4 + Math.random() * 0.85); // Opponent's table half (Z < 0)

    const flightTime = isSmash ? 0.36 : 0.48;
    this._launchBallAcrossTable(this.ball.pos, new THREE.Vector3(targetX, S.TABLE_SURFACE_Y, targetZ), flightTime, {
      topspin: isSmash ? 24 : 14,
      isSmash
    });

    this.ball.inPlay = true;
    this.ball.lastHitter = "player";
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount += 1;
    this.ball.shotType = isSmash ? "SMASH" : shotType;
    this.ball.isPowerShot = isSmash;
    this.ballTrail.setStyle(this.ball.shotType, isSmash);

    // Track match statistics
    const speedKmh = Math.round(isSmash ? 88 + Math.random() * 24 : 58 + Math.random() * 16);
    this.matchStats.playerReturns += 1;
    this.matchStats.currentSet.playerReturns += 1;
    if (isSmash) {
      this.matchStats.playerSmashes += 1;
      this.matchStats.currentSet.playerSmashes += 1;
    }
    this.matchStats.playerMaxSpeedKmh = Math.max(this.matchStats.playerMaxSpeedKmh, speedKmh);
    this.matchStats.longestRally = Math.max(this.matchStats.longestRally, this.ball.rallyStrokeCount);
    this.matchStats.currentSet.longestRally = Math.max(this.matchStats.currentSet.longestRally, this.ball.rallyStrokeCount);

    this.audioEngine && this.audioEngine.playRacketHit(isSmash ? "smash" : "topspin", "good");
    this.facialFX && this.facialFX.setExpression(this.player, isSmash ? "effort_shout" : "focused_squint", 0.6);

    this.hud.showTimingPopup({
      grade: isSmash ? "¡SMASH POTENTE!" : isBackhand ? "REVÉS TOPSPIN" : "DERECHA TOPSPIN",
      detail: `${speedKmh} KM/H`,
      screenPos: this._projectToScreen(this.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0)))
    });
    this.hud.updateTimingGauge({
      cursorNormalized: 0.5,
      modeTitle: isSmash ? "SMASH" : "GOLPE CON ÉXITO",
      speedText: `${speedKmh} KM/H`
    });

    this._predictBallIntercept(this.opponent);
    return true;
  }

  _attemptP2RallyStrike(evt = {}) {
    if (this.ball.lastHitter === "opponent") return false;

    const diffZ = this.opponent.pos.z - this.ball.pos.z;
    const diffX = Math.abs(this.ball.pos.x - this.opponent.pos.x);
    const dist = Math.hypot(diffX, diffZ);

    if (dist > 1.6 || this.ball.pos.y > 1.85 || this.ball.pos.y < 0.68) return false;

    if (this.ball.bounceCountOnCurrentSide < 1) {
      this._awardPoint("player", "Falta: Volea Prohibida");
      return true;
    }

    const shotType = String(evt.shotType || this.p2SelectedShotType || "TOPSPIN").toUpperCase();
    const isSmash = shotType === "SMASH" || this.ball.pos.y > 1.25;
    const isBackhand = this.ball.pos.x > this.opponent.pos.x + 0.04;

    this.opponent.swingType = isSmash ? "smash" : isBackhand ? "backhand" : "forehand";
    this.opponent.swingDuration = 0.28;
    this.opponent.swingTimer = 0.28;

    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(this.opponent, {
        shotType: isSmash ? "smash" : shotType.toLowerCase(),
        side: isSmash ? "overhead" : isBackhand ? "backhand" : "forehand",
        speed: 1.3,
        timing: "sweet"
      });
    }

    const dirX = Number(evt.dirX || 0);
    const targetX = THREE.MathUtils.clamp(-dirX * 0.55 + (Math.random() - 0.5) * 0.4, -S.TABLE_HALF_W + 0.1, S.TABLE_HALF_W - 0.1);
    const targetZ = 0.4 + Math.random() * 0.85; // Player's table half (Z > 0)

    const flightTime = isSmash ? 0.36 : 0.48;
    this._launchBallAcrossTable(this.ball.pos, new THREE.Vector3(targetX, S.TABLE_SURFACE_Y, targetZ), flightTime, {
      topspin: isSmash ? 24 : 14,
      isSmash
    });

    this.ball.inPlay = true;
    this.ball.lastHitter = "opponent";
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount += 1;
    this.ball.shotType = isSmash ? "SMASH" : shotType;
    this.ball.isPowerShot = isSmash;
    this.ballTrail.setStyle(this.ball.shotType, isSmash);

    // Track opponent match statistics (P2)
    const speedKmhP2 = Math.round(isSmash ? 88 + Math.random() * 24 : 58 + Math.random() * 16);
    this.matchStats.opponentReturns += 1;
    this.matchStats.currentSet.opponentReturns += 1;
    if (isSmash) {
      this.matchStats.opponentSmashes += 1;
      this.matchStats.currentSet.opponentSmashes += 1;
    }
    this.matchStats.opponentMaxSpeedKmh = Math.max(this.matchStats.opponentMaxSpeedKmh, speedKmhP2);
    this.matchStats.longestRally = Math.max(this.matchStats.longestRally, this.ball.rallyStrokeCount);
    this.matchStats.currentSet.longestRally = Math.max(this.matchStats.currentSet.longestRally, this.ball.rallyStrokeCount);

    this.audioEngine && this.audioEngine.playRacketHit(isSmash ? "smash" : "topspin", "good");
    this.facialFX && this.facialFX.setExpression(this.opponent, isSmash ? "effort_shout" : "focused_squint", 0.6);

    this._predictBallIntercept(this.player);
    return true;
  }

  _executeAiReturn() {
    if (this.ball.lastHitter === "opponent") return;
    if (this.ball.bounceCountOnCurrentSide < 1) return; // Wait for bounce

    const isPro = this.matchConfig.difficulty === "pro";
    const isSmash = this.ball.pos.y > 1.25 && (isPro || Math.random() < 0.6);
    const isBackhand = this.ball.pos.x > this.opponent.pos.x + 0.04;

    this.opponent.swingType = isSmash ? "smash" : isBackhand ? "backhand" : "forehand";
    this.opponent.swingDuration = 0.28;
    this.opponent.swingTimer = 0.28;

    if (this.racketKinematics) {
      this.racketKinematics.triggerSwing(this.opponent, {
        shotType: isSmash ? "smash" : "topspin",
        side: isSmash ? "overhead" : isBackhand ? "backhand" : "forehand",
        speed: 1.2,
        timing: "sweet"
      });
    }

    // Place shot on player's half
    const side = this.player.pos.x >= 0 ? -1 : 1;
    const targetX = THREE.MathUtils.clamp(side * (0.25 + Math.random() * 0.4), -S.TABLE_HALF_W + 0.12, S.TABLE_HALF_W - 0.12);
    const targetZ = 0.35 + Math.random() * 0.85;

    const flightTime = isSmash ? 0.38 : isPro ? 0.46 : 0.54;
    this._launchBallAcrossTable(this.ball.pos, new THREE.Vector3(targetX, S.TABLE_SURFACE_Y, targetZ), flightTime, {
      topspin: isSmash ? 22 : 12,
      isSmash
    });

    this.ball.inPlay = true;
    this.ball.lastHitter = "opponent";
    this.ball.bounceCountOnCurrentSide = 0;
    this.ball.rallyStrokeCount += 1;
    this.ball.shotType = isSmash ? "SMASH" : "TOPSPIN";
    this.ball.isPowerShot = isSmash;
    this.ballTrail.setStyle(this.ball.shotType, isSmash);

    // Track opponent match statistics (AI)
    const speedKmhAi = Math.round(isSmash ? 84 + Math.random() * 20 : 56 + Math.random() * 15);
    this.matchStats.opponentReturns += 1;
    this.matchStats.currentSet.opponentReturns += 1;
    if (isSmash) {
      this.matchStats.opponentSmashes += 1;
      this.matchStats.currentSet.opponentSmashes += 1;
    }
    this.matchStats.opponentMaxSpeedKmh = Math.max(this.matchStats.opponentMaxSpeedKmh, speedKmhAi);
    this.matchStats.longestRally = Math.max(this.matchStats.longestRally, this.ball.rallyStrokeCount);
    this.matchStats.currentSet.longestRally = Math.max(this.matchStats.currentSet.longestRally, this.ball.rallyStrokeCount);

    this.audioEngine && this.audioEngine.playRacketHit(isSmash ? "smash" : "topspin", "good");
    this.facialFX && this.facialFX.setExpression(this.opponent, "effort_shout", 0.5);

    this._predictBallIntercept(this.player);
  }

  _launchBallAcrossTable(fromPt, targetPt, flightTime, { topspin = 14, isSmash = false } = {}) {
    const t = Math.max(0.3, flightTime);
    const dx = targetPt.x - fromPt.x;
    const dz = targetPt.z - fromPt.z;
    const dy = targetPt.y - fromPt.y;

    // Table tennis gravity arc
    const g = L.GRAVITY + topspin * 0.15;
    const vx = dx / t;
    const vz = dz / t;
    let vy = (dy + 0.5 * g * t * t) / t;

    // Ensure ball clears the net (net height: 0.9125m at Z = 0)
    const timeToNet = Math.abs(fromPt.z) / Math.max(0.01, Math.abs(vz));
    const ballYAtNet = fromPt.y + vy * timeToNet - 0.5 * g * timeToNet * timeToNet;
    const minNetClearance = S.NET_TOP_Y + (isSmash ? 0.04 : 0.08);

    if (ballYAtNet < minNetClearance) {
      const boost = (minNetClearance - ballYAtNet) / timeToNet;
      vy += boost;
    }

    this.ball.vel.set(vx, vy, vz);
    this.ball.spin.set(topspin, 0, 0);
    this.ball.targetLanding.copy(targetPt);
  }

  _predictBallIntercept(actor) {
    const target = this.ball.targetLanding;
    // Move slightly behind the predicted table bounce point
    const destZ = THREE.MathUtils.clamp(
      target.z + actor.sideSign * 0.85,
      actor.sideSign > 0 ? 1.5 : -2.8,
      actor.sideSign > 0 ? 2.8 : -1.5
    );
    const destX = THREE.MathUtils.clamp(target.x, -S.TABLE_HALF_W - 0.2, S.TABLE_HALF_W + 0.2);
    actor.targetPos.set(destX, 0, destZ);
  }

  update(dt) {
    this.elapsedTime += dt;
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.5);

    for (this.physicsAccumulator += dt; this.physicsAccumulator >= L.FIXED_DT;) {
      this._stepPhysics(L.FIXED_DT);
      this.physicsAccumulator -= L.FIXED_DT;
    }

    this._updateMiiAnimation(this.player, dt);
    this._updateMiiAnimation(this.opponent, dt);
    this._updateEffects(dt);
    this._updateCameraRig(dt);
    this._updateProjectedHUD();
  }

  _stepPhysics(dt) {
    this.phaseTimer += dt;
    if (this.player.swingCooldown > 0) this.player.swingCooldown = Math.max(0, this.player.swingCooldown - dt);
    if (this.opponent.swingCooldown > 0) this.opponent.swingCooldown = Math.max(0, this.opponent.swingCooldown - dt);

    // AI Serve execution
    if (this.phase === "SERVE_STANCE" && !this.persistentStateLock) {
      if (this.score.server === "opponent" && !this.isMultiplayer && this.phaseTimer > 1.1) {
        this._startServeToss(this.opponent);
      } else if (this.autoPlayMode && this.score.server === "player" && this.phaseTimer > 1.2) {
        this._startServeToss(this.player);
      }
    }

    // Serve toss physics
    if (this.phase === "SERVE_TOSS") {
      this.ball.pos.addScaledVector(this.ball.vel, dt);
      this.ball.vel.y -= L.GRAVITY * dt;

      // AI executes serve at toss apex
      if ((this.score.server === "opponent" && !this.isMultiplayer || this.autoPlayMode) && this.ball.vel.y <= 0.35 && this.ball.pos.y >= 1.2) {
        const actor = this.score.server === "player" ? this.player : this.opponent;
        this._executeServeHit(actor);
        return;
      }

      // If toss drops without hit, reset to stance
      if (this.ball.pos.y <= 0.88 && this.ball.vel.y < 0) {
        this.phase = "SERVE_STANCE";
        this.phaseTimer = 0;
        this.ball.vel.set(0, 0, 0);
      }
      return;
    }

    if (this.phase === "POINT_OVER") {
      if (this.phaseTimer > 1.85) {
        this._setupPointServe({ showBanner: true });
      }
      return;
    }

    if (this.phase === "RALLY" && this.ball.inPlay) {
      // Step ball physics
      const speed = this.ball.vel.length();
      const drag = Math.max(0, 1 - L.AIR_DRAG * speed * dt);
      this.ball.vel.multiplyScalar(drag);
      this.ball.vel.y -= (L.GRAVITY + this.ball.spin.x * 0.12) * dt;
      this.ball.pos.addScaledVector(this.ball.vel, dt);

      if (this.ball.mesh) {
        this.ball.mesh.rotation.x += this.ball.vel.z * dt * 2.5;
        this.ball.mesh.rotation.z -= this.ball.vel.x * dt * 2.5;
      }
      this.ballTrail.pushPoint(this.ball.pos);

      // Check Net Collision (Z = 0, Y in [0.76, 0.9125], X in [-0.915, 0.915])
      const prevZ = this.ball.pos.z - this.ball.vel.z * dt;
      const crossedNet = (prevZ > 0 && this.ball.pos.z <= 0) || (prevZ < 0 && this.ball.pos.z >= 0);

      if (crossedNet && Math.abs(this.ball.pos.x) <= S.NET_POST_X) {
        if (this.ball.pos.y <= S.NET_TOP_Y) {
          // Hit the net!
          this.ball.vel.z *= -0.22;
          this.ball.vel.y = 0.85;
          this.audioEngine && this.audioEngine.playNetCord();

          // Net fault point
          const loser = this.ball.lastHitter;
          const winner = loser === "player" ? "opponent" : "player";
          this._awardPoint(winner, "Falta: Red");
          return;
        }
      }

      // Check Table Top Collision (Surface at Y = 0.76)
      const onTableX = Math.abs(this.ball.pos.x) <= S.TABLE_HALF_W;
      const onTableZ = Math.abs(this.ball.pos.z) <= S.TABLE_HALF_L;
      const hitTableSurface = this.ball.pos.y <= S.TABLE_SURFACE_Y && this.ball.pos.y >= S.TABLE_SURFACE_Y - 0.08 && this.ball.vel.y < 0;

      if (hitTableSurface) {
        if (onTableX && onTableZ) {
          // Valid bounce on table!
          this.ball.pos.y = S.TABLE_SURFACE_Y;
          this.ball.vel.y = Math.abs(this.ball.vel.y) * L.BOUNCE_RESTITUTION;
          this.ball.vel.x *= L.SURFACE_FRICTION;
          this.ball.vel.z *= L.SURFACE_FRICTION;

          this._spawnBounceRing(this.ball.pos.x, this.ball.pos.z);
          this.audioEngine && this.audioEngine.playBallBounce(1.1);

          // Table tennis rules check
          const isPlayerSide = this.ball.pos.z > 0;
          const isHitterPlayer = this.ball.lastHitter === "player";

          // If this is the serve's first bounce:
          if (this.ball.rallyStrokeCount === 1 && !this.ball.hasBouncedOnServerTable) {
            const validServerHalf = isHitterPlayer ? isPlayerSide : !isPlayerSide;
            if (validServerHalf) {
              this.ball.hasBouncedOnServerTable = true;
              return;
            } else {
              // Failed to bounce on own table first on serve
              this._awardPoint(isHitterPlayer ? "opponent" : "player", "Fallo de Saque");
              return;
            }
          }

          // In rally: must bounce on receiver's table half
          if (isHitterPlayer && isPlayerSide) {
            // Player hit ball into their own side
            this._awardPoint("opponent", "Falta: Bote en propio campo");
            return;
          }
          if (!isHitterPlayer && !isPlayerSide) {
            // Opponent hit ball into their own side
            this._awardPoint("player", "Falta: Bote en propio campo");
            return;
          }

          this.ball.bounceCountOnCurrentSide += 1;
          if (this.ball.bounceCountOnCurrentSide >= 2) {
            // Double bounce: point for hitter!
            this._awardPoint(this.ball.lastHitter, "¡Doble Bote!");
            return;
          }
        }
      }

      // Ball missed table and dropped below table height
      if (this.ball.pos.y < 0.62) {
        const winner = this.ball.lastHitter === "player" ? (this.ball.bounceCountOnCurrentSide >= 1 ? "player" : "opponent") : (this.ball.bounceCountOnCurrentSide >= 1 ? "opponent" : "player");
        this._awardPoint(winner, "Fuera");
        return;
      }

      // Footwork movement
      this._stepActorFootwork(this.player, dt);
      this._stepActorFootwork(this.opponent, dt);

      // AI response on player's shot
      if (this.ball.lastHitter === "player" && this.ball.pos.z < -0.3 && !this.isMultiplayer) {
        const diffZ = Math.abs(this.opponent.pos.z - this.ball.pos.z);
        const diffX = Math.abs(this.opponent.pos.x - this.ball.pos.x);
        if (this.ball.bounceCountOnCurrentSide === 1 && diffZ < 0.85 && diffX < 0.95 && this.ball.pos.y < 1.35) {
          this._executeAiReturn();
        }
      }
    }
  }

  _stepActorFootwork(actor, dt) {
    const dx = actor.targetPos.x - actor.pos.x;
    const dz = actor.targetPos.z - actor.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.04) {
      const step = Math.min(dist, actor.maxSpeed * dt);
      actor.pos.x += (dx / dist) * step;
      actor.pos.z += (dz / dist) * step;
      actor.stridePhase += step * 5.2;
    }
  }

  _awardPoint(winnerRole, reason = "") {
    this.phase = "POINT_OVER";
    this.phaseTimer = 0;
    this.ball.inPlay = false;

    const isPlayerWin = winnerRole === "player";
    if (isPlayerWin) {
      this.score.playerPoints += 1;
      this.matchStats.playerTotalPoints += 1;
      this.matchStats.currentSet.playerPoints += 1;
      this.matchStats.opponentErrors += 1;
    } else {
      this.score.opponentPoints += 1;
      this.matchStats.opponentTotalPoints += 1;
      this.matchStats.currentSet.opponentPoints += 1;
      this.matchStats.playerErrors += 1;
    }

    if (winnerRole === this.score.server) {
      if (isPlayerWin) this.matchStats.playerServicePoints += 1;
      else this.matchStats.opponentServicePoints += 1;
    }

    this.bodyAnimator && this.bodyAnimator.triggerPointReaction(this.player, isPlayerWin ? "win" : "loss");
    this.bodyAnimator && this.bodyAnimator.triggerPointReaction(this.opponent, isPlayerWin ? "loss" : "win");
    this.facialFX && this.facialFX.setExpression(this.player, isPlayerWin ? "happy_grin" : "shocked_loss", 1.8);
    this.facialFX && this.facialFX.setExpression(this.opponent, isPlayerWin ? "shocked_loss" : "happy_grin", 1.8);

    this.audioEngine && this.audioEngine.playCrowdReaction(isPlayerWin ? "cheer" : "ooh");

    // Service rotation according to official ITTF rules:
    // Every 2 points normally; every 1 point if in Deuce (10-10 or higher)
    const totalPoints = this.score.playerPoints + this.score.opponentPoints;
    const isDeuce = this.score.playerPoints >= 10 && this.score.opponentPoints >= 10;
    const rotationFreq = isDeuce ? 1 : 2;
    const isInitialServerTurn = Math.floor(totalPoints / rotationFreq) % 2 === 0;
    this.score.server = isInitialServerTurn ? this.initialServer : (this.initialServer === "player" ? "opponent" : "player");

    // Check Set (Game) Win: first to 11 with difference of 2
    const p = this.score.playerPoints;
    const o = this.score.opponentPoints;
    const setWon = (p >= 11 || o >= 11) && Math.abs(p - o) >= 2;

    if (setWon) {
      const setWinner = p > o ? "player" : "opponent";
      if (p > o) this.score.playerGames += 1;
      else this.score.opponentGames += 1;

      // Save record of finished set
      this.matchStats.setHistory.push({
        setNumber: this.matchStats.setHistory.length + 1,
        playerPoints: p,
        opponentPoints: o,
        winner: setWinner
      });

      this.score.playerPoints = 0;
      this.score.opponentPoints = 0;

      // Switch initial server for next set
      this.initialServer = this.initialServer === "player" ? "opponent" : "player";
      this.score.server = this.initialServer;

      this._syncScoreboardHUD();

      // Check Match Win
      const matchWon = this.score.playerGames >= this.matchConfig.gamesToWin || this.score.opponentGames >= this.matchConfig.gamesToWin;
      if (matchWon) {
        const matchWinnerP1 = this.score.playerGames > this.score.opponentGames;
        this.phase = "MATCH_OVER";
        const bannerTitle = matchWinnerP1 ? "¡VICTORIA! 🏓" : "FIN DEL PARTIDO";
        const sub = `Resultado: ${this.score.playerGames} - ${this.score.opponentGames} Sets`;
        this._recordBannerBroadcast(bannerTitle, "style-gold", sub);
        this.hud.showCenterBanner(bannerTitle, { style: "style-gold", subText: sub, durationMs: 2800 });
        this.audioEngine && this.audioEngine.playMusicForState("victory");

        setTimeout(() => {
          this.hud.showVictoryModal({
            playerWon: matchWinnerP1,
            playerGames: this.score.playerGames,
            opponentGames: this.score.opponentGames
          });
          this.showMatchStats("match");
        }, 1800);
        return;
      }

      // Set won banner & transition with statistics overlay
      const setBanner = `¡JUEGO! (${this.score.playerGames} - ${this.score.opponentGames})`;
      this._recordBannerBroadcast(setBanner, "style-gold", "Cambio de Campo");
      this.hud.showCenterBanner(setBanner, { style: "style-gold", subText: "Cambio de Campo", durationMs: 1800 });

      setTimeout(() => {
        this.showMatchStats("set", {
          currentSetNumber: this.matchStats.setHistory.length,
          setPlayerPoints: p,
          setOpponentPoints: o
        });
      }, 1400);
      return;
    }

    this._syncScoreboardHUD();
    const { bannerScoreText } = this._formatCurrentScore();
    const style = reason === "Fuera" || reason.includes("Falta") ? "style-fault" : "style-score";
    this._recordBannerBroadcast(bannerScoreText, style, reason);
    this.hud.showCenterBanner(bannerScoreText, { style, subText: reason, durationMs: 1400 });
  }

  _formatCurrentScore() {
    const p = this.score.playerPoints;
    const o = this.score.opponentPoints;
    if (p >= 10 && o >= 10) {
      if (p === o) {
        return {
          playerScoreText: String(p),
          opponentScoreText: String(o),
          deuceLabel: "Deuce (10-10)",
          bannerScoreText: "Deuce 10-10"
        };
      }
      const pAdv = p > o;
      const label = pAdv ? `Ventaja (${p}-${o})` : `Ventaja (${p}-${o})`;
      return {
        playerScoreText: String(p),
        opponentScoreText: String(o),
        deuceLabel: label,
        bannerScoreText: label
      };
    }
    const pStr = String(p).padStart(2, "0");
    const oStr = String(o).padStart(2, "0");
    return {
      playerScoreText: pStr,
      opponentScoreText: oStr,
      deuceLabel: null,
      bannerScoreText: `${pStr} - ${oStr}`
    };
  }

  _getHighStakesPointLabel() {
    const p = this.score.playerPoints;
    const o = this.score.opponentPoints;
    const pLead = p >= 10 && p - o >= 1;
    const oLead = o >= 10 && o - p >= 1;
    if (pLead) {
      return this.score.playerGames + 1 >= this.matchConfig.gamesToWin ? "Match Point" : "Game Point";
    }
    if (oLead) {
      return this.score.opponentGames + 1 >= this.matchConfig.gamesToWin ? "Match Point" : "Game Point";
    }
    if (p >= 10 && o >= 10 && p === o) {
      return "Deuce";
    }
    return null;
  }

  _syncScoreboardHUD() {
    const formatted = this._formatCurrentScore();
    this.hud.updateScoreboard({
      playerScoreText: formatted.playerScoreText,
      opponentScoreText: formatted.opponentScoreText,
      deuceLabel: formatted.deuceLabel,
      playerGames: this.score.playerGames,
      opponentGames: this.score.opponentGames,
      gamesToWin: this.matchConfig.gamesToWin
    });
  }

  _recordBannerBroadcast(text, style = "style-score", subText = "") {
    this.bannerSeq += 1;
    this.lastBannerBroadcast = { seq: this.bannerSeq, text, style, subText };
  }

  _updateMiiAnimation(actor, dt) {
    if (!actor.model) return;
    if (actor.swingTimer > 0) actor.swingTimer = Math.max(0, actor.swingTimer - dt);

    if (this.racketKinematics) {
      this.racketKinematics.update(actor, dt, {
        phase: this.phase,
        score: this.score,
        ball: this.ball,
        elapsedTime: this.elapsedTime
      });
    }

    if (this.bodyAnimator) {
      this.bodyAnimator.updateMiiBodyAnimation(actor, dt, this);
    } else {
      actor.root.position.copy(actor.pos);
    }

    updateCharacterContactShadow(actor, actor.rig?.verticalHopOffset || 0);
    this.facialFX && this.facialFX.update(actor, dt, {
      phase: this.phase,
      ball: this.ball,
      score: this.score,
      rallyCount: this.ball.rallyStrokeCount,
      camera: this.camera
    });
  }

  _spawnBounceRing(x, z) {
    const ring = this.bounceRings.find(r => !r.active) || this.bounceRings[0];
    ring.active = true;
    ring.age = 0;
    ring.mesh.position.set(x, S.TABLE_SURFACE_Y + 0.002, z);
    ring.mesh.scale.setScalar(0.4);
    ring.mesh.material.opacity = 0.95;
    ring.mesh.visible = true;
  }

  _updateEffects(dt) {
    if (this.ball.mesh) this.ball.mesh.position.copy(this.ball.pos);

    if (this.ballShadowBlob) {
      this.ballShadowBlob.position.x = this.ball.pos.x;
      this.ballShadowBlob.position.z = this.ball.pos.z;
      // If over table, cast shadow on table, else floor
      const onTable = Math.abs(this.ball.pos.x) <= S.TABLE_HALF_W && Math.abs(this.ball.pos.z) <= S.TABLE_HALF_L;
      this.ballShadowBlob.position.y = onTable ? S.TABLE_SURFACE_Y + 0.001 : 0.005;

      const heightAbove = this.ball.pos.y - this.ballShadowBlob.position.y;
      const scale = THREE.MathUtils.clamp(1.1 - heightAbove * 0.45, 0.4, 1.1);
      this.ballShadowBlob.scale.setScalar(scale);
      this.ballShadowBlob.material.opacity = THREE.MathUtils.clamp(0.85 - heightAbove * 0.35, 0.25, 0.85);
    }

    for (const r of this.bounceRings) {
      if (!r.active) continue;
      r.age += dt;
      const progress = r.age / 0.38;
      if (progress >= 1) {
        r.active = false;
        r.mesh.visible = false;
      } else {
        r.mesh.scale.setScalar(0.4 + progress * 1.5);
        r.mesh.material.opacity = (1 - progress) * 0.9;
      }
    }

    this.ballTrail.updateGeometry(this.camera);
  }

  _computeTargetCameraPose() {
    const mode = this.manualCameraOverride || this.cameraMode;
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();

    if (mode === "INTRO_PAN") {
      const a = this.elapsedTime * 0.35;
      targetPos.set(Math.sin(a) * 3.8, 1.95, 3.2 + Math.cos(a) * 1.2);
      targetLook.set(0, 0.82, 0);
    } else if (mode === "SERVE_CAM") {
      const isPlayer = this.score.server === "player";
      if (isPlayer) {
        targetPos.set(this.player.pos.x * 0.25, 1.76, 3.65);
        targetLook.set(this.player.pos.x * 0.1, 0.88, -0.5);
      } else {
        targetPos.set(this.opponent.pos.x * 0.25, 1.76, -3.65);
        targetLook.set(this.opponent.pos.x * 0.1, 0.88, 0.5);
      }
    } else if (mode === "REPLAY_CAM") {
      targetPos.set(1.4, 1.08, 0.2);
      targetLook.set(-0.25, 0.82, 0);
    } else {
      // Olympic table tennis broadcast rally perspective
      targetPos.set(this.player.pos.x * 0.22, 1.78, 3.75);
      targetLook.set(this.ball.pos.x * 0.18, 0.84, -0.6);
    }

    return { targetPos, targetLook };
  }

  _snapCameraImmediate() {
    const { targetPos, targetLook } = this._computeTargetCameraPose();
    this.cameraPosSmooth.copy(targetPos);
    this.cameraLookSmooth.copy(targetLook);
    this.camera.position.copy(targetPos);
    this.camera.lookAt(targetLook);
    this.camera.updateMatrixWorld();
  }

  _updateCameraRig(dt) {
    const { targetPos, targetLook } = this._computeTargetCameraPose();
    const alpha = 1 - Math.exp(-7.2 * dt);
    this.cameraPosSmooth.lerp(targetPos, alpha);
    this.cameraLookSmooth.lerp(targetLook, alpha);
    this.camera.position.copy(this.cameraPosSmooth);

    if (this.cameraTrauma > 0.001) {
      const s = this.cameraTrauma * this.cameraTrauma * 0.08;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.cameraLookSmooth);
  }

  _projectToScreen(pos) {
    const p = pos.clone().project(this.camera);
    const visible = p.z >= -1 && p.z <= 1;
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    return { x, y, visible };
  }

  _updateProjectedHUD() {
    if (this.phase === "SERVE_STANCE" || this.phase === "SERVE_TOSS") {
      const serverActor = this.score.server === "player" ? this.player : this.opponent;
      const screenPos = this._projectToScreen(serverActor.pos.clone().add(new THREE.Vector3(0, 1.6, 0)));
      this.hud.updateServerTag(screenPos, true);
    } else {
      this.hud.updateServerTag(null, false);
    }
  }

  showMatchStats(type = "match", extra = {}) {
    if (window.__matchStatsOverlay) {
      const pGames = this.score.playerGames;
      const oGames = this.score.opponentGames;
      const payload = {
        ...this.matchStats,
        player1Name: "Jugador 1",
        player2Name: this.isMultiplayer ? "Jugador 2" : (this.matchConfig.difficulty === "pro" ? "Matt (IA Pro)" : "Club IA"),
        is1v1: this.isMultiplayer,
        isPro: this.matchConfig.difficulty === "pro",
        playerGames: pGames,
        opponentGames: oGames,
        currentSetNumber: this.matchStats.setHistory.length || 1,
        winner: pGames > oGames ? "player" : "opponent",
        ...extra
      };
      window.__matchStatsOverlay.show(payload, type);
    }
  }

  _startNextSet() {
    this.score.playerPoints = 0;
    this.score.opponentPoints = 0;
    this.matchStats.currentSet = {
      setNumber: this.matchStats.setHistory.length + 1,
      playerPoints: 0,
      opponentPoints: 0,
      playerSmashes: 0,
      opponentSmashes: 0,
      longestRally: 0,
      playerReturns: 0,
      opponentReturns: 0
    };
    this._syncScoreboardHUD();
    const nextSetNum = this.score.playerGames + this.score.opponentGames + 1;
    this._setupPointServe({
      showBanner: true,
      bannerText: `Set ${nextSetNum}`,
      bannerStyle: "style-gold"
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const engine = new ArgonTennisEngine();
  window.__argonTennis = engine;
  engine.loadAssetsAndStart();
});
