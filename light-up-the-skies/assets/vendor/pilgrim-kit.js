import * as e from "./three.module.min.js";
import { BufferAttribute as t, BufferGeometry as n } from "./three.module.min.js";
//#region ../../../../pilgrim/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
function r(e, t = !1) {
	let r = e[0].index !== null, a = new Set(Object.keys(e[0].attributes)), o = new Set(Object.keys(e[0].morphAttributes)), s = {}, c = {}, l = e[0].morphTargetsRelative, u = new n(), d = 0;
	for (let n = 0; n < e.length; ++n) {
		let i = e[n], f = 0;
		if (r !== (i.index !== null)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."), null;
		for (let e in i.attributes) {
			if (!a.has(e)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". All geometries must have compatible attributes; make sure \"" + e + "\" attribute exists among all geometries, or in none of them."), null;
			s[e] === void 0 && (s[e] = []), s[e].push(i.attributes[e]), f++;
		}
		if (f !== a.size) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". Make sure all geometries have the same number of attributes."), null;
		if (l !== i.morphTargetsRelative) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". .morphTargetsRelative must be consistent throughout all geometries."), null;
		for (let e in i.morphAttributes) {
			if (!o.has(e)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ".  .morphAttributes must be consistent throughout all geometries."), null;
			c[e] === void 0 && (c[e] = []), c[e].push(i.morphAttributes[e]);
		}
		if (t) {
			let e;
			if (r) e = i.index.count;
			else if (i.attributes.position !== void 0) e = i.attributes.position.count;
			else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". The geometry must have either an index or a position attribute"), null;
			u.addGroup(d, e, n), d += e;
		}
	}
	if (r) {
		let t = 0, n = [];
		for (let r = 0; r < e.length; ++r) {
			let i = e[r].index;
			for (let e = 0; e < i.count; ++e) n.push(i.getX(e) + t);
			t += e[r].attributes.position.count;
		}
		u.setIndex(n);
	}
	for (let e in s) {
		let t = i(s[e]);
		if (!t) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " attribute."), null;
		u.setAttribute(e, t);
	}
	for (let e in c) {
		let t = c[e][0].length;
		if (t !== 0) {
			u.morphAttributes = u.morphAttributes || {}, u.morphAttributes[e] = [];
			for (let n = 0; n < t; ++n) {
				let t = [];
				for (let r = 0; r < c[e].length; ++r) t.push(c[e][r][n]);
				let r = i(t);
				if (!r) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " morphAttribute."), null;
				u.morphAttributes[e].push(r);
			}
		}
	}
	return u;
}
function i(e) {
	let n, r, i, a = -1, o = 0;
	for (let t = 0; t < e.length; ++t) {
		let s = e[t];
		if (n === void 0 && (n = s.array.constructor), n !== s.array.constructor) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."), null;
		if (r === void 0 && (r = s.itemSize), r !== s.itemSize) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."), null;
		if (i === void 0 && (i = s.normalized), i !== s.normalized) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."), null;
		if (a === -1 && (a = s.gpuType), a !== s.gpuType) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."), null;
		o += s.count * r;
	}
	let s = new n(o), c = new t(s, r, i), l = 0;
	for (let t = 0; t < e.length; ++t) {
		let n = e[t];
		if (n.isInterleavedBufferAttribute) {
			let e = l / r;
			for (let t = 0, i = n.count; t < i; t++) for (let i = 0; i < r; i++) {
				let r = n.getComponent(t, i);
				c.setComponent(t + e, i, r);
			}
		} else s.set(n.array, l);
		l += n.count * r;
	}
	return a !== void 0 && (c.gpuType = a), c;
}
//#endregion
//#region ../../../../pilgrim/src/gen/geom.ts
var a = new e.Color(), o = /* @__PURE__ */ new Map();
function s(t) {
	let n = o.get(t);
	return n || (n = new e.Color(t), o.set(t, n)), n;
}
function c(t) {
	let n = t.index ? t.toNonIndexed() : t;
	n !== t && t.dispose();
	for (let e of Object.keys(n.attributes)) e !== "position" && e !== "color" && n.deleteAttribute(e);
	if (n.morphAttributes = {}, n.clearGroups(), n.computeVertexNormals(), !n.getAttribute("color")) {
		let t = n.getAttribute("position").count;
		n.setAttribute("color", new e.BufferAttribute(new Float32Array(t * 3).fill(1), 3));
	}
	return n.computeBoundingBox(), n.computeBoundingSphere(), n;
}
function l(t, n = 1) {
	return c(new e.IcosahedronGeometry(t, n));
}
function u(t, n, r, i = .04) {
	let a = Math.max(0, Math.min(i, t / 2 - .001, n / 2 - .001, r / 2 - .001));
	if (a <= 0) return c(new e.BoxGeometry(t, n, r));
	let o = t / 2 - a, s = n / 2 - a, l = new e.Shape();
	l.moveTo(-o, -s), l.lineTo(o, -s), l.lineTo(o, s), l.lineTo(-o, s), l.closePath();
	let u = new e.ExtrudeGeometry(l, {
		depth: r - 2 * a,
		bevelEnabled: !0,
		bevelThickness: a,
		bevelSize: a,
		bevelSegments: 1,
		curveSegments: 1
	});
	return u.translate(0, 0, -(r - 2 * a) / 2), c(u);
}
function d(t, n, r = 7) {
	let i = new e.ConeGeometry(t, n, r, 1);
	return i.translate(0, n / 2, 0), c(i);
}
function f(t, n, r, i = 7) {
	let a = new e.CylinderGeometry(t, n, r, i, 1);
	return a.translate(0, r / 2, 0), c(a);
}
function p(t, n = 8, r = 0, i = Math.PI * 2) {
	let a = t.map(([t, n]) => new e.Vector2(Math.max(0, t), n));
	return c(new e.LatheGeometry(a, n, r, i));
}
function m(t, n, r = 0) {
	let i = new e.Shape(t.map(([t, n]) => new e.Vector2(t, n))), a = new e.ExtrudeGeometry(i, {
		depth: n,
		bevelEnabled: r > 0,
		bevelThickness: r,
		bevelSize: r,
		bevelSegments: 1,
		curveSegments: 4
	});
	return a.translate(0, 0, -n / 2), c(a);
}
function h(e, t, n) {
	let r = e.getAttribute("position"), i = /* @__PURE__ */ new Map();
	for (let e = 0; e < r.count; e++) {
		let a = r.getX(e), o = r.getY(e), s = r.getZ(e), c = `${Math.round(a * 1e4)},${Math.round(o * 1e4)},${Math.round(s * 1e4)}`, l = i.get(c);
		l || (l = [
			n.range(-t, t),
			n.range(-t, t),
			n.range(-t, t)
		], i.set(c, l)), r.setXYZ(e, a + l[0], o + l[1], s + l[2]);
	}
	return r.needsUpdate = !0, e.computeVertexNormals(), e.computeBoundingBox(), e.computeBoundingSphere(), e;
}
function g(t, n) {
	let r = t.getAttribute("color");
	if (typeof n == "string") {
		let e = s(n);
		for (let t = 0; t < r.count; t++) r.setXYZ(t, e.r, e.g, e.b);
	} else {
		let i = t.getAttribute("position"), o = t.getAttribute("normal"), c = new e.Vector3(), l = new e.Vector3();
		for (let e = 0; e + 2 < i.count; e += 3) {
			c.set((i.getX(e) + i.getX(e + 1) + i.getX(e + 2)) / 3, (i.getY(e) + i.getY(e + 1) + i.getY(e + 2)) / 3, (i.getZ(e) + i.getZ(e + 1) + i.getZ(e + 2)) / 3), l.set(o.getX(e), o.getY(e), o.getZ(e)), a.copy(s(n(c, l)));
			for (let t = 0; t < 3; t++) r.setXYZ(e + t, a.r, a.g, a.b);
		}
	}
	return r.needsUpdate = !0, t;
}
var _ = new e.Matrix4(), v = new e.Quaternion(), y = new e.Euler(), b = new e.Vector3(), x = new e.Vector3();
function S(e, t) {
	var n, r, i;
	let a = (n = t.scale) == null ? 1 : n;
	return x.set(...typeof a == "number" ? [
		a,
		a,
		a
	] : a), v.setFromEuler(y.set(...(r = t.rot) == null ? [
		0,
		0,
		0
	] : r)), b.set(...(i = t.pos) == null ? [
		0,
		0,
		0
	] : i), e.applyMatrix4(_.compose(b, v, x)), x.x * x.y * x.z < 0 && C(e), e.computeVertexNormals(), e;
}
function C(e) {
	for (let t of ["position", "color"]) {
		let n = e.getAttribute(t), r = n.array;
		for (let e = 0; e + 2 < n.count; e += 3) for (let t = 0; t < 3; t++) {
			let n = r[(e + 1) * 3 + t];
			r[(e + 1) * 3 + t] = r[(e + 2) * 3 + t], r[(e + 2) * 3 + t] = n;
		}
		n.needsUpdate = !0;
	}
}
function w(t) {
	if (t.length === 0) return c(new e.BufferGeometry().setAttribute("position", new e.Float32BufferAttribute([], 3)));
	if (t.length === 1) return t[0];
	let n = r(t, !1);
	if (!n) throw Error("geom.merge: incompatible attributes (build pieces with geom.ts helpers)");
	for (let e of t) e.dispose();
	return n.computeBoundingBox(), n.computeBoundingSphere(), n;
}
//#endregion
//#region \0@oxc-project+runtime@0.153.0/helpers/esm/typeof.js
function T(e) {
	"@babel/helpers - typeof";
	return T = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, T(e);
}
//#endregion
//#region \0@oxc-project+runtime@0.153.0/helpers/esm/toPrimitive.js
function E(e, t) {
	if (T(e) != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (T(r) != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
//#endregion
//#region \0@oxc-project+runtime@0.153.0/helpers/esm/toPropertyKey.js
function ee(e) {
	var t = E(e, "string");
	return T(t) == "symbol" ? t : t + "";
}
//#endregion
//#region \0@oxc-project+runtime@0.153.0/helpers/esm/defineProperty.js
function D(e, t, n) {
	return (t = ee(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
//#endregion
//#region ../../../../pilgrim/src/gen/fx/WorldFX.ts
var te = .6, ne = "#FFD27A", re = "worldfx:1", ie = "/* world-fx */";
function ae(t, n = new e.Color()) {
	let r = parseInt(t.replace("#", ""), 16);
	return n.setRGB((r >> 16 & 255) / 255, (r >> 8 & 255) / 255, (r & 255) / 255, e.LinearSRGBColorSpace);
}
var oe = {
	uDesaturation: { value: 0 },
	uLanternPos: { value: new e.Vector3() },
	uLanternRadius: { value: 0 },
	uLanternOn: { value: 0 },
	uLanternColor: { value: ae(ne) }
}, se = `
${ie}
uniform float uDesaturation;
uniform vec3 uLanternPos;
uniform float uLanternRadius;
uniform float uLanternOn;
uniform vec3 uLanternColor;
vec3 worldFxGrade(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(c, vec3(l), uDesaturation);
}
vec3 worldFx(vec3 c, vec3 wp) {
  c = worldFxGrade(c);
  if (uLanternOn > 0.0) {
    float k = 1.0 - smoothstep(uLanternRadius * 0.45, max(uLanternRadius, 0.001), distance(wp, uLanternPos));
    vec3 lit = c * mix(vec3(1.0), uLanternColor, 0.45) * (1.0 + 0.45 * k);
    c = mix(c, mix(c * 0.18, lit, k), clamp(uLanternOn, 0.0, 1.0));
  }
  return c;
}
`, ce = "\nvec4 fxWorld = vec4(transformed, 1.0);\n#ifdef USE_BATCHING\nfxWorld = batchingMatrix * fxWorld;\n#endif\n#ifdef USE_INSTANCING\nfxWorld = instanceMatrix * fxWorld;\n#endif\nvFxWorld = (modelMatrix * fxWorld).xyz;\n", le = /* @__PURE__ */ new WeakSet(), ue = !1;
function de(e, t, n) {
	let r = e.indexOf(t);
	return r < 0 ? null : `${e.slice(0, r + t.length)}\n${n}${e.slice(r + t.length)}`;
}
function fe(e) {
	var t, n;
	let r = de((t = de(e.vertexShader, "#include <common>", "varying vec3 vFxWorld;")) == null ? "" : t, "#include <project_vertex>", ce), i = de((n = de(e.fragmentShader, "#include <common>", `varying vec3 vFxWorld;\n${se}`)) == null ? "" : n, "#include <fog_fragment>", "gl_FragColor.rgb = worldFx(gl_FragColor.rgb, vFxWorld);");
	!r || !i ? (ue || console.warn("[worldfx] shader anchors not found; this material keeps its normal colours"), ue = !0) : (Object.assign(e.uniforms, oe), e.vertexShader = r, e.fragmentShader = i);
}
function pe() {
	return re;
}
function me(t) {
	le.has(t) || t instanceof e.ShaderMaterial || (le.add(t), t.onBeforeCompile = fe, t.customProgramCacheKey = pe, t.needsUpdate = !0);
}
new class {
	constructor() {
		D(this, "target", 1), D(this, "current", 1);
	}
	get saturation() {
		return this.current;
	}
	get targetSaturation() {
		return this.target;
	}
	setSaturation(e, t = !1) {
		this.target = Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 1, t && this.apply(this.target);
	}
	setLantern(e, t, n, r) {
		let i = oe;
		i.uLanternOn.value = typeof e == "number" ? Math.min(1, Math.max(0, e)) : +!!e, t && i.uLanternPos.value.copy(t), n !== void 0 && Number.isFinite(n) && (i.uLanternRadius.value = Math.max(0, n)), r && ae(r, i.uLanternColor.value);
	}
	update(e) {
		if (this.current === this.target || !(e > 0)) return;
		let t = 1 - Math.exp(-e / te), n = this.current + (this.target - this.current) * t;
		this.apply(Math.abs(this.target - n) < .002 ? this.target : n);
	}
	reset() {
		this.target = 1, this.apply(1), this.setLantern(!1, void 0, 0, ne), oe.uLanternPos.value.set(0, 0, 0);
	}
	apply(e) {
		this.current = e, oe.uDesaturation.value = 1 - e;
	}
}();
//#endregion
//#region ../../../../pilgrim/src/gen/materials.ts
var he = /* @__PURE__ */ new Map(), ge = null;
function _e() {
	if (!ge) {
		let t = new Uint8Array([
			110,
			110,
			110,
			255,
			190,
			190,
			190,
			255,
			255,
			255,
			255,
			255
		]);
		ge = new e.DataTexture(t, 3, 1, e.RGBAFormat), ge.minFilter = e.NearestFilter, ge.magFilter = e.NearestFilter, ge.generateMipmaps = !1, ge.needsUpdate = !0;
	}
	return ge;
}
function ve(t) {
	switch (t) {
		case "lambert":
		case "skinned": return new e.MeshLambertMaterial({
			vertexColors: !0,
			flatShading: !0
		});
		case "toon": return new e.MeshToonMaterial({
			vertexColors: !0,
			gradientMap: _e()
		});
		case "path": return new e.MeshLambertMaterial({
			vertexColors: !0,
			flatShading: !0,
			polygonOffset: !0,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2
		});
		case "glow": return new e.MeshBasicMaterial({
			vertexColors: !0,
			toneMapped: !1
		});
		case "unlit": return new e.MeshBasicMaterial({ vertexColors: !0 });
		case "unlitTransparent": return new e.MeshBasicMaterial({
			vertexColors: !0,
			transparent: !0,
			depthWrite: !1
		});
		case "decal": return new e.MeshBasicMaterial({
			vertexColors: !0,
			transparent: !0,
			depthWrite: !1,
			polygonOffset: !0,
			polygonOffsetFactor: -4,
			polygonOffsetUnits: -4
		});
	}
}
function ye(e) {
	let t = he.get(e);
	return t || (t = ve(e), t.name = `shared:${e}`, e !== "glow" && e !== "decal" && me(t), he.set(e, t)), t;
}
//#endregion
//#region ../../../../pilgrim/src/gen/palette.ts
var O = [
	.45,
	.8,
	.35
], be = [
	.8,
	.35,
	.2
], xe = {
	title: {
		id: "title",
		sky: {
			top: "#5E6FA8",
			horizon: "#F2C9A0",
			bottom: "#E8B98F",
			sun: "#FFE8A3"
		},
		fog: {
			color: "#E9C3A2",
			near: 60,
			far: 320
		},
		light: {
			sun: "#FFE2B8",
			sunIntensity: 1.67,
			sunDir: be,
			hemiSky: "#C9D6F0",
			hemiGround: "#8A7A5A",
			hemiIntensity: 1.65
		},
		ground: {
			low: "#8DBF6A",
			mid: "#7FAF5F",
			high: "#A7B98A",
			slope: "#9C8F78",
			path: "#E8D3A3",
			pathEdge: "#BFAF8C",
			detour: "#9FB0A8"
		},
		water: {
			shallow: "#8FC9D9",
			deep: "#3F7F9C"
		},
		accents: { horizonLight: "#FFE8A3" }
	},
	test: {
		id: "test",
		sky: {
			top: "#6FA8DC",
			horizon: "#CFE6F2",
			bottom: "#E6EEDC",
			sun: "#FFF4D6"
		},
		fog: {
			color: "#CFE2E8",
			near: 60,
			far: 300
		},
		light: {
			sun: "#FFF1DC",
			sunIntensity: 1.82,
			sunDir: O,
			hemiSky: "#CFE6F2",
			hemiGround: "#7A8A5A",
			hemiIntensity: 1.65
		},
		ground: {
			low: "#8DBF6A",
			mid: "#7FB05C",
			high: "#A9B98C",
			slope: "#9A8C74",
			path: "#E8D3A3",
			pathEdge: "#BCA987",
			detour: "#93A9A6"
		},
		water: {
			shallow: "#8FC9D9",
			deep: "#3F7F9C"
		},
		accents: {}
	},
	city: {
		id: "city",
		sky: {
			top: "#6B4A5E",
			horizon: "#E8A26B",
			bottom: "#C98A66",
			sun: "#FFE8A3"
		},
		fog: {
			color: "#B9876F",
			near: 35,
			far: 230
		},
		light: {
			sun: "#F2B47E",
			sunIntensity: 1.37,
			sunDir: be,
			hemiSky: "#B98A8E",
			hemiGround: "#5E4E44",
			hemiIntensity: 1.5
		},
		ground: {
			low: "#8F8A62",
			mid: "#86805C",
			high: "#9C9474",
			slope: "#8C8577",
			path: "#D9B98C",
			pathEdge: "#8C8577",
			detour: "#8E8C80"
		},
		water: {
			shallow: "#8A9AA0",
			deep: "#4E5A66"
		},
		accents: {
			dusk: "#E8A26B",
			plum: "#6B4A5E",
			stone: "#8C8577",
			timber: "#6E5D50",
			horizonLight: "#FFE8A3"
		}
	},
	slough: {
		id: "slough",
		sky: {
			top: "#7F8986",
			horizon: "#9AA3A0",
			bottom: "#A7ACA2",
			sun: "#E6E2D0"
		},
		fog: {
			color: "#98A09C",
			near: 25,
			far: 170
		},
		light: {
			sun: "#E8E4D4",
			sunIntensity: 1.06,
			sunDir: O,
			hemiSky: "#A9B2AE",
			hemiGround: "#4E4230",
			hemiIntensity: 1.8
		},
		ground: {
			low: "#5B4A35",
			mid: "#6E6A45",
			high: "#80834F",
			slope: "#6A5C44",
			path: "#C9B184",
			pathEdge: "#8A7A5C",
			detour: "#7A7A66"
		},
		water: {
			shallow: "#6E5B40",
			deep: "#4A3B29"
		},
		accents: {
			mud: "#5B4A35",
			reeds: "#8A8B5A",
			sky: "#9AA3A0",
			stepsGlow: "#F5E6B8"
		}
	},
	wrongHill: {
		id: "wrongHill",
		sky: {
			top: "#6FAFD6",
			horizon: "#A9D3E8",
			bottom: "#D8EADF",
			sun: "#FFF4D6"
		},
		fog: {
			color: "#BFDCE6",
			near: 60,
			far: 320
		},
		light: {
			sun: "#FFF0D6",
			sunIntensity: 1.82,
			sunDir: O,
			hemiSky: "#BFE0F0",
			hemiGround: "#6A8A4A",
			hemiIntensity: 1.65
		},
		ground: {
			low: "#8DBF6A",
			mid: "#7FB35E",
			high: "#9BC77A",
			slope: "#8E8A6E",
			path: "#E6CF9C",
			pathEdge: "#B8A47E",
			detour: "#C7D9B8"
		},
		water: {
			shallow: "#8FC9D9",
			deep: "#3F7F9C"
		},
		accents: {
			hills: "#8DBF6A",
			sky: "#A9D3E8",
			mountain: "#5E4B5C",
			fire: "#FF8A3D"
		}
	},
	wicketGate: {
		id: "wicketGate",
		sky: {
			top: "#7A86A8",
			horizon: "#D9CDB4",
			bottom: "#CFC2A8",
			sun: "#FFF2C2"
		},
		fog: {
			color: "#C9BFAE",
			near: 40,
			far: 240
		},
		light: {
			sun: "#FFEFCF",
			sunIntensity: 1.52,
			sunDir: O,
			hemiSky: "#C4C8D8",
			hemiGround: "#6E6050",
			hemiIntensity: 1.65
		},
		ground: {
			low: "#8FA86A",
			mid: "#86985F",
			high: "#9C9C78",
			slope: "#8C8270",
			path: "#E3CFA3",
			pathEdge: "#B9A98A",
			detour: "#9AA39A"
		},
		water: {
			shallow: "#8FB9C9",
			deep: "#46708A"
		},
		accents: {
			wall: "#C9BBA0",
			gate: "#8A5A3B",
			castle: "#3E3548",
			safeLight: "#FFF2C2"
		}
	},
	interpreter: {
		id: "interpreter",
		sky: {
			top: "#2E2A3E",
			horizon: "#6B4F52",
			bottom: "#4A3A36",
			sun: "#F2C98A"
		},
		fog: {
			color: "#3E302C",
			near: 20,
			far: 90
		},
		light: {
			sun: "#F2C98A",
			sunIntensity: .91,
			sunDir: O,
			hemiSky: "#F2C98A",
			hemiGround: "#5A3A2A",
			hemiIntensity: 1.35
		},
		ground: {
			low: "#8B5A3C",
			mid: "#7E5236",
			high: "#9A6A48",
			slope: "#6E4A32",
			path: "#C99A6A",
			pathEdge: "#8B5A3C",
			detour: "#7A6458"
		},
		water: {
			shallow: "#8FB9C9",
			deep: "#46708A"
		},
		accents: {
			candle: "#F2C98A",
			wood: "#8B5A3C",
			warmRed: "#B5523B"
		}
	},
	cross: {
		id: "cross",
		sky: {
			top: "#9DB8DE",
			horizon: "#F7C9A8",
			bottom: "#FFE9A8",
			sun: "#FFF3C9"
		},
		fog: {
			color: "#F5D9BE",
			near: 50,
			far: 280
		},
		light: {
			sun: "#FFE4BE",
			sunIntensity: 1.67,
			sunDir: be,
			hemiSky: "#FFE9C8",
			hemiGround: "#7AA050",
			hemiIntensity: 1.8
		},
		ground: {
			low: "#9ED26A",
			mid: "#92C760",
			high: "#A9D87C",
			slope: "#A8A07E",
			path: "#EED8A8",
			pathEdge: "#C4B08A",
			detour: "#B8CFA8"
		},
		water: {
			shallow: "#9FD3E0",
			deep: "#4F8CA6"
		},
		accents: {
			dawnA: "#F7C9A8",
			dawnB: "#FFE9A8",
			grass: "#9ED26A",
			cross: "#A0703F",
			tomb: "#B9B3A6"
		}
	},
	hill: {
		id: "hill",
		sky: {
			top: "#6F62A8",
			horizon: "#8C7BC4",
			bottom: "#E7B9A4",
			sun: "#FFE0B8"
		},
		fog: {
			color: "#A99BC9",
			near: 50,
			far: 280
		},
		light: {
			sun: "#FFD9B0",
			sunIntensity: 1.44,
			sunDir: be,
			hemiSky: "#B9AEE0",
			hemiGround: "#5F8A48",
			hemiIntensity: 1.65
		},
		ground: {
			low: "#7FBF5F",
			mid: "#72B055",
			high: "#8CC46E",
			slope: "#8E8670",
			path: "#E6CF9C",
			pathEdge: "#B8A47E",
			detour: "#7E8C86"
		},
		water: {
			shallow: "#8FC9D9",
			deep: "#3F7F9C"
		},
		accents: {
			hillGreen: "#7FBF5F",
			dusk: "#8C7BC4",
			palace: "#F4EEE2",
			roofs: "#6C8FB3"
		}
	},
	humiliation: {
		id: "humiliation",
		sky: {
			top: "#5B4A7A",
			horizon: "#A98FB0",
			bottom: "#C9B4A8",
			sun: "#FFD9A8"
		},
		fog: {
			color: "#8E7FA0",
			near: 40,
			far: 230
		},
		light: {
			sun: "#FFD2A8",
			sunIntensity: 1.37,
			sunDir: be,
			hemiSky: "#A99BC4",
			hemiGround: "#5A7A4A",
			hemiIntensity: 1.65
		},
		ground: {
			low: "#7FAF6A",
			mid: "#749F60",
			high: "#8AA878",
			slope: "#7E7468",
			path: "#DCC79A",
			pathEdge: "#A8977A",
			detour: "#7E8A80"
		},
		water: {
			shallow: "#8FB9C9",
			deep: "#46708A"
		},
		accents: {
			valley: "#7FAF6A",
			sky: "#5B4A7A",
			fire: "#FF7A2F",
			scales: "#3F6F78",
			wings: "#8C2F39"
		}
	},
	shadow: {
		id: "shadow",
		sky: {
			top: "#0C0B12",
			horizon: "#1E1A2A",
			bottom: "#14121C",
			sun: "#9FB8D9"
		},
		fog: {
			color: "#14121C",
			near: 6,
			far: 45
		},
		light: {
			sun: "#6A6E8A",
			sunIntensity: .19,
			sunDir: O,
			hemiSky: "#2A2838",
			hemiGround: "#0E0C14",
			hemiIntensity: .52
		},
		ground: {
			low: "#2A2632",
			mid: "#33303C",
			high: "#3E3A46",
			slope: "#24212C",
			path: "#5A5246",
			pathEdge: "#3A3530",
			detour: "#2A2A30"
		},
		water: {
			shallow: "#2A2A38",
			deep: "#141420"
		},
		accents: {
			dark: "#14121C",
			lantern: "#FFD27A",
			embers: "#E2553A",
			dawn: "#9FB8D9"
		}
	},
	vanity: {
		id: "vanity",
		sky: {
			top: "#5FA8E0",
			horizon: "#F6D6E6",
			bottom: "#F2E2C8",
			sun: "#FFF2C8"
		},
		fog: {
			color: "#EAD9E6",
			near: 50,
			far: 260
		},
		light: {
			sun: "#FFEED8",
			sunIntensity: 1.82,
			sunDir: O,
			hemiSky: "#E9DDF5",
			hemiGround: "#8A7A5A",
			hemiIntensity: 1.8
		},
		ground: {
			low: "#A9C77A",
			mid: "#9DBB6E",
			high: "#B4C98E",
			slope: "#A09078",
			path: "#E8D3A3",
			pathEdge: "#C2A985",
			detour: "#C9A0C0"
		},
		water: {
			shallow: "#8FC9D9",
			deep: "#3F7F9C"
		},
		accents: {
			pink: "#E64B8B",
			mustard: "#F2C230",
			violet: "#7B4FD6",
			teal: "#2EC4B6",
			night: "#22304A"
		}
	},
	doubting: {
		id: "doubting",
		sky: {
			top: "#6FAFD6",
			horizon: "#CFE6E0",
			bottom: "#E0EBD0",
			sun: "#FFF4D6"
		},
		fog: {
			color: "#C9DCD8",
			near: 50,
			far: 280
		},
		light: {
			sun: "#FFF0D6",
			sunIntensity: 1.67,
			sunDir: O,
			hemiSky: "#CFE6F0",
			hemiGround: "#6A8A4A",
			hemiIntensity: 1.65
		},
		ground: {
			low: "#A6D96A",
			mid: "#98CC5E",
			high: "#B0D884",
			slope: "#9A9080",
			path: "#E2CB98",
			pathEdge: "#A89A84",
			detour: "#B6E07E"
		},
		water: {
			shallow: "#8FD0E0",
			deep: "#3F86A6"
		},
		accents: {
			meadow: "#A6D96A",
			storm: "#39414F",
			castle: "#6F6A73",
			keyGold: "#FFC94A"
		}
	},
	delectable: {
		id: "delectable",
		sky: {
			top: "#5FB4E6",
			horizon: "#9FD8F5",
			bottom: "#DDF0E8",
			sun: "#FFF6DC"
		},
		fog: {
			color: "#C6E6F2",
			near: 70,
			far: 360
		},
		light: {
			sun: "#FFF2DA",
			sunIntensity: 1.9,
			sunDir: O,
			hemiSky: "#CFEAF8",
			hemiGround: "#6FA05A",
			hemiIntensity: 1.72
		},
		ground: {
			low: "#8FD17E",
			mid: "#82C472",
			high: "#9ED68E",
			slope: "#9C9688",
			path: "#ECD7A6",
			pathEdge: "#BFAE8C",
			detour: "#E9B872"
		},
		water: {
			shallow: "#9FD8F5",
			deep: "#4A90B8"
		},
		accents: {
			green: "#8FD17E",
			sky: "#9FD8F5",
			sheep: "#F7F4EC",
			haze: "#E9B872"
		}
	},
	river: {
		id: "river",
		sky: {
			top: "#7FB8E8",
			horizon: "#FFE7B8",
			bottom: "#FFF3D6",
			sun: "#FFFFFF"
		},
		fog: {
			color: "#FCEBD0",
			near: 60,
			far: 340
		},
		light: {
			sun: "#FFF1D2",
			sunIntensity: 1.98,
			sunDir: O,
			hemiSky: "#FFF0D8",
			hemiGround: "#88B070",
			hemiIntensity: 1.95
		},
		ground: {
			low: "#9CD47A",
			mid: "#90CA70",
			high: "#B2DC8E",
			slope: "#B8AE96",
			path: "#F2E2B8",
			pathEdge: "#D2BE96",
			detour: "#C9D9B8"
		},
		water: {
			shallow: "#9FDCEB",
			deep: "#3C7FA8"
		},
		accents: {
			cityGold: "#FFE7A0",
			flowersPink: "#F2A0C0",
			flowersBlue: "#9FB8F2",
			flowersYellow: "#FFE07A"
		}
	},
	epilogue: {
		id: "epilogue",
		sky: {
			top: "#6B5A86",
			horizon: "#F0B47E",
			bottom: "#D9A27E",
			sun: "#FFE8A3"
		},
		fog: {
			color: "#C99A80",
			near: 35,
			far: 230
		},
		light: {
			sun: "#F6C08A",
			sunIntensity: 1.44,
			sunDir: be,
			hemiSky: "#C9A0A4",
			hemiGround: "#5E4E44",
			hemiIntensity: 1.58
		},
		ground: {
			low: "#8F8A62",
			mid: "#86805C",
			high: "#9C9474",
			slope: "#8C8577",
			path: "#D9B98C",
			pathEdge: "#8C8577",
			detour: "#8E8C80"
		},
		water: {
			shallow: "#8A9AA0",
			deep: "#4E5A66"
		},
		accents: {
			dusk: "#E8A26B",
			plum: "#6B4A5E",
			stone: "#8C8577",
			timber: "#6E5D50",
			horizonLight: "#FFE8A3",
			secret: "#2E3A6B"
		}
	}
};
function Se(e) {
	let t = xe[e];
	if (!t) throw Error(`Unknown palette "${e}"`);
	return t;
}
function Ce(e) {
	return `#${e.getHexString()}`;
}
function k(t, n) {
	let r = new e.Color(t), i = {
		h: 0,
		s: 0,
		l: 0
	};
	return r.getHSL(i), r.setHSL(i.h, i.s, Math.min(1, Math.max(0, i.l + n))), Ce(r);
}
function A(t, n, r) {
	return Ce(new e.Color(t).lerp(new e.Color(n), r));
}
function we(e, t, n) {
	return k(e, (n * 2 - 1) * t);
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-kit.ts
function Te(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function j(e, t, n, r = -Infinity, i = Infinity) {
	let a = e[t], o = typeof a == "number" ? a : typeof a == "string" ? Number.parseFloat(a) : NaN;
	return Te(Number.isFinite(o) ? o : n, r, i);
}
function M(e, t, n) {
	let r = e[t];
	return typeof r == "boolean" ? r : typeof r == "number" ? r !== 0 : typeof r == "string" ? r === "true" || r === "1" : n;
}
function Ee(e, t, n) {
	let r = e[t];
	return typeof r == "string" && r.length > 0 ? r : n;
}
function N(e, t) {
	let n = e[t];
	return typeof n == "string" && /^#[0-9a-fA-F]{6}$/.test(n) ? n : null;
}
var De = /* @__PURE__ */ new WeakMap();
function Oe(...e) {
	for (let t of e) if (t) return t;
}
function P(e) {
	var t, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g;
	let _ = De.get(e);
	if (_) return _;
	let v = e.accents, y = e.ground, b = (t = Oe(v.timber, v.wood, v.gate, v.cross)) == null ? A("#8A6446", y.slope, .2) : t, x = (n = Oe(v.stone, v.tomb, v.wall)) == null ? A("#9C958A", y.slope, .3) : n, S = e.sky.top, C = (r = Oe(v.horizonLight, v.candle, v.safeLight, v.lantern, v.stepsGlow, v.cityGold)) == null ? "#FFE3A0" : r, w = (i = Oe(v.grass, v.hillGreen, v.green, v.meadow, v.hills)) == null ? k(y.low, -.06) : i, T = v.roofs, E = [
		v.pink,
		v.mustard,
		v.violet,
		v.teal,
		v.warmRed
	].filter((e) => !!e), ee = {
		wood: b,
		woodDark: k(b, -.08),
		woodLight: k(b, .1),
		stone: x,
		stoneDark: k(x, -.08),
		stoneLight: k(x, .08),
		wall: (a = v.wall) == null ? x : a,
		plaster: [
			A("#F0E3C8", y.path, .3),
			A("#EBD3A6", y.path, .3),
			A("#EDCDBE", y.path, .3),
			A("#DCD8C8", y.path, .3)
		],
		roof: T ? [
			T,
			k(T, -.08),
			A(T, "#7E6A86", .3)
		] : [
			A("#9A5444", S, .18),
			A("#6E6878", S, .2),
			A(b, "#B07A50", .5)
		],
		straw: A("#D6B466", y.path, .3),
		iron: A("#45434C", S, .12),
		brass: "#C9A44E",
		gold: (o = Oe(v.keyGold, v.cityGold, v.mustard)) == null ? "#E8C25A" : o,
		windowGlow: A(C, "#FFC46A", .4),
		flame: A((s = Oe(v.candle, v.lantern)) == null ? "#FFC86A" : s, "#FFA63D", .35),
		flameCore: "#FFF4D0",
		wax: "#F4ECD8",
		gate: (c = v.gate) == null ? k(b, -.04) : c,
		castle: (l = Oe(v.castle, v.storm)) == null ? A("#4A4552", S, .2) : l,
		cross: (u = v.cross) == null ? b : u,
		tomb: (d = v.tomb) == null ? x : d,
		palace: (f = v.palace) == null ? A("#F2EBDD", y.path, .15) : f,
		palaceRoof: T == null ? "#6C8FB3" : T,
		mountain: (p = v.mountain) == null ? A(y.slope, S, .4) : p,
		leaf: w,
		leafDark: k(w, -.1),
		grass: y.mid,
		earth: y.slope,
		path: y.path,
		cloth: E.length >= 3 ? E : [
			"#B5523B",
			"#E8C25A",
			"#4F7FA6",
			"#7A9A5A",
			"#E7D3B0"
		],
		blossom: [
			(m = v.flowersPink) == null ? "#F2A0C0" : m,
			(h = v.flowersYellow) == null ? "#FFE07A" : h,
			(g = v.flowersBlue) == null ? "#FFFFFF" : g
		],
		hollow: "#1E1A1C",
		glass: A("#3A4252", S, .3),
		water: e.water.deep
	};
	return De.set(e, ee), ee;
}
var ke = /* @__PURE__ */ new Map();
function F(e, t, n) {
	let r = Math.round(n.range(-t, t) / .025);
	if (r === 0) return e;
	let i = `${e}|${r}`, a = ke.get(i);
	return a || (a = k(e, r * .025), ke.set(i, a)), a;
}
var Ae = new e.Vector3(0, 1, 0), je = new e.Vector3(), Me = new e.Quaternion(), Ne = new e.Euler(), Pe = new e.Matrix4();
function I(e, t, n, r, i = {}, a = 0) {
	return S(g(u(e, t, n, a), r), i);
}
function L(e, t, n, r, i = {}, a = 6) {
	return S(g(f(e, t, n, a), r), i);
}
function R(e, t, n, r, i = n) {
	je.set(t[0] - e[0], t[1] - e[1], t[2] - e[2]);
	let a = je.length();
	return Me.setFromUnitVectors(Ae, je.normalize()), Ne.setFromQuaternion(Me), I(n, a, i, r, {
		pos: [
			(e[0] + t[0]) / 2,
			(e[1] + t[1]) / 2,
			(e[2] + t[2]) / 2
		],
		rot: [
			Ne.x,
			Ne.y,
			Ne.z
		]
	});
}
function Fe(e, t, n, r, i = 5) {
	je.set(t[0] - e[0], t[1] - e[1], t[2] - e[2]);
	let a = je.length();
	return Me.setFromUnitVectors(Ae, je.normalize()), Ne.setFromQuaternion(Me), L(n, n, a, r, {
		pos: e,
		rot: [
			Ne.x,
			Ne.y,
			Ne.z
		]
	}, i);
}
function z(e, t, n, r = {}, i = 0) {
	return S(g(m(e, t, i), n), r);
}
function Ie(e, t, n) {
	return t === 0 && n === 0 || (Pe.set(1, t, 0, 0, 0, 1, 0, 0, 0, n, 1, 0, 0, 0, 0, 1), e.applyMatrix4(Pe), e.computeVertexNormals()), e;
}
function B(e, t, n, r, i, a, o) {
	let s = [];
	for (let c = 0; c <= o; c++) {
		let l = i + (a - i) * c / o;
		s.push([e + Math.cos(l) * n, t + Math.sin(l) * r]);
	}
	return s;
}
function Le(e = 8) {
	return p([
		[1, -.1],
		[.93, .38],
		[.72, .74],
		[.4, .95],
		[0, 1]
	], e);
}
function V(t, n, r = {}) {
	return S(g(c(new e.OctahedronGeometry(t, 0)), n), r);
}
function Re(e, t, n, r, i, a) {
	e.glow(S(g(l(a, 0), t.flameCore), {
		pos: [
			n,
			r + a,
			i
		],
		scale: [
			1,
			1.1,
			1
		]
	})), e.glow(S(g(d(a * .82, a * 2.2, 5), t.flame), { pos: [
		n,
		r + a * 1.1,
		i
	] }));
}
function ze(e) {
	return (t) => e[((Math.imul(Math.round(t.x * 37) ^ Math.imul(Math.round(t.y * 53), 73244475), 668265261) ^ Math.round(t.z * 71)) >>> 0) % e.length];
}
function Be(e, t, n = .55) {
	return (r, i) => i.y > n ? e : t;
}
var H = class {
	constructor() {
		D(this, "solid", []), D(this, "lit", []), D(this, "colliders", []);
	}
	add(...e) {
		for (let t of e) this.solid.push(t);
		return this;
	}
	glow(...e) {
		for (let t of e) this.lit.push(t);
		return this;
	}
	boxCol(e, t, n, r, i, a = 0, o = 0) {
		return this.colliders.push({
			kind: "box",
			center: [
				e,
				o + r / 2,
				t
			],
			half: [
				n / 2,
				r / 2,
				i / 2
			],
			rotY: a
		}), this;
	}
	cylCol(e, t, n, r, i = 0) {
		return this.colliders.push({
			kind: "cylinder",
			center: [
				e,
				i + r / 2,
				t
			],
			radius: n,
			height: r
		}), this;
	}
	ballCol(e, t, n, r) {
		return this.colliders.push({
			kind: "sphere",
			center: [
				e,
				t,
				n
			],
			radius: r
		}), this;
	}
	absorb(e, t) {
		let n = (e) => {
			var n;
			if (e.length === 0) return null;
			let r = w(e.splice(0));
			return t.lean && Ie(r, t.lean[0], t.lean[1]), S(r, {
				pos: t.pos,
				rot: [
					0,
					(n = t.rotY) == null ? 0 : n,
					0
				]
			});
		}, r = n(e.solid), i = n(e.lit);
		return r && this.solid.push(r), i && this.lit.push(i), this;
	}
	done() {
		let e = {
			geometry: w(this.solid.splice(0)),
			colliders: this.colliders
		};
		return this.lit.length > 0 && (e.glow = w(this.lit.splice(0))), e;
	}
};
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-chapter.ts
function Ve(e, t) {
	var n, r, i, a;
	let o = e.accents;
	return (n = (r = (i = (a = o.horizonLight) == null ? o.safeLight : a) == null ? o.stepsGlow : i) == null ? o.candle : r) == null ? t.windowGlow : n;
}
function He(e, t, n) {
	var r;
	let i = P(t), a = new H(), o = j(n, "height", .72, .4, 1.2), s = M(n, "glow", !0), c = (r = N(n, "color")) == null ? A("#7A3B2E", i.wood, .25) : r, l = A(Ve(t, i), "#FFF6DC", .45), u = .86, d = .7;
	for (let t of [-1, 1]) for (let n of [-1, 1]) a.add(I(.09, o - .06, .09, F(i.woodDark, .04, e), {
		pos: [
			t * (u / 2 - .1),
			(o - .06) / 2 - .02,
			n * (d / 2 - .1)
		],
		rot: [
			n * .03,
			0,
			-t * .03
		]
	}));
	a.add(I(.6, .1, .43999999999999995, i.woodDark, { pos: [
		0,
		o - .12,
		0
	] })), a.add(h(I(u, .07, d, F(i.wood, .04, e), { pos: [
		0,
		o - .035,
		0
	] }, .02), .01, e)), a.boxCol(0, 0, u, o, d);
	let p = .42, m = .1, _ = .34, v = o, y = e.range(-.12, .12), b = new H(), x = .02;
	for (let e of [x / 2, m - x / 2]) b.add(I(p, x, _, c, { pos: [
		.01,
		e,
		0
	] }, .006));
	b.add(S(g(f(.052000000000000005, .052000000000000005, _, 6), c), {
		rot: [
			Math.PI / 2,
			0,
			0
		],
		pos: [
			-.42 / 2 + .01,
			m / 2,
			-.34 / 2
		]
	})), b.add(I(.05, .016, .06, i.gold, { pos: [
		p / 2 - .02,
		.10200000000000001,
		0
	] }));
	for (let e of [-1, 1]) b.add(V(.014, i.gold, { pos: [
		p / 2 - .04,
		.10600000000000001,
		e * (_ / 2 - .05)
	] }));
	let C = I(.39, .064, .32, l, { pos: [
		.03,
		m / 2,
		0
	] });
	return s ? (b.glow(C), b.glow(I(.44, .012, .37, A(l, "#FFFFFF", .3), { pos: [
		.03,
		m / 2,
		0
	] })), b.glow(I(.52, .006, .44000000000000006, Ve(t, i), { pos: [
		.01,
		.004,
		0
	] }))) : b.add(C), a.absorb(b, {
		pos: [
			0,
			v,
			0
		],
		rotY: y
	}), a.done();
}
function Ue(e, t, n) {
	var r;
	let i = P(t), a = new H(), o = j(n, "height", 40, 4, 400), s = j(n, "radius", 1.6, .2, 20), c = (r = N(n, "color")) == null ? Ve(t, i) : r, l = A(c, "#FFFFFF", .6), u = A(c, t.sky.horizon, .5), d = A(c, t.sky.horizon, .2);
	a.glow(g(p([
		[s * .2, 0],
		[s * .5, o * .14],
		[s * .4, o * .6],
		[s * .12, o * .93],
		[0, o]
	], 6), l));
	let f = [
		[-s * .5, 0],
		[s * .5, 0],
		[s * 1.5, o * .2],
		[s * .9, o * .6],
		[s * .2, o * .96],
		[-s * .2, o * .96],
		[-s * .9, o * .6],
		[-s * 1.5, o * .2]
	], h = e.range(0, Math.PI / 4);
	for (let e = 0; e < 2; e++) {
		let t = g(m(f, .04), (e) => Math.abs(e.x) < s * .6 ? d : u);
		a.glow(S(t, { rot: [
			0,
			h + e * Math.PI / 2,
			0
		] }));
	}
	let _ = o * .9;
	return a.glow(V(s * 1.4, l, {
		pos: [
			0,
			_,
			0
		],
		scale: [
			1,
			2.6,
			.35
		],
		rot: [
			0,
			h,
			0
		]
	})), a.glow(V(s * 1.4, d, {
		pos: [
			0,
			_,
			0
		],
		scale: [
			3,
			.9,
			.35
		],
		rot: [
			0,
			h + .3,
			0
		]
	})), a.add(g(p([
		[s * 1.4, -.3],
		[s * 1.1, s * .35],
		[0, s * .5]
	], 7), A(i.stoneLight, c, .35))), a.done();
}
function We(e, t, n) {
	var r;
	let i = P(t), a = j(n, "scale", 1, .3, 4), o = j(n, "tilt", .35, -1, 1), s = (r = N(n, "color")) == null ? A(i.wood, "#8A5A3B", .5) : r, c = k(s, -.22), u = new H(), d = .17, f = .12, p = .3;
	u.add(I(.19, .035, .32999999999999996, c, { pos: [
		0,
		.018,
		0
	] }, .01));
	let m = F(s, .03, e);
	u.add(I(d, f, p * .72, m, { pos: [
		0,
		.095,
		-.036
	] }, .035)), u.add(S(g(l(d * .58, 1), m), {
		pos: [
			0,
			.0926,
			p * .14
		],
		scale: [
			.95,
			f / (d * 1.16),
			1.05
		]
	})), u.add(I(d * .9, .03, .08, c, { pos: [
		0,
		.05,
		-.3 * .38
	] })), u.add(L(.08, .075, .2, s, {
		pos: [
			0,
			.125,
			-.066
		],
		rot: [
			.12,
			0,
			0
		]
	}, 7)), u.add(L(.09, .082, .04, k(s, -.1), { pos: [
		0,
		.155 + .14,
		-.08600000000000001
	] }, 7)), u.add(I(.03, .05, .012, k(s, -.14), { pos: [
		0,
		.325,
		-.166
	] }));
	let h = u.done();
	S(h.geometry, {
		rot: [
			-o,
			0,
			0
		],
		pos: [
			0,
			0,
			p * .2
		]
	}), S(h.geometry, { scale: a }), h.geometry.computeBoundingBox();
	let _ = Math.min(0, h.geometry.boundingBox.min.y);
	return _ < -.01 && S(h.geometry, { pos: [
		0,
		-_ - .03 * a,
		0
	] }), h;
}
function Ge(e, t, n) {
	var r;
	let i = P(t), a = new H(), o = j(n, "width", 1.6, .6, 6), s = j(n, "height", 1.3, .4, 5), c = o * .86, u = (r = N(n, "color")) == null ? i.stone : r, d = ze([
		u,
		F(u, .05, e),
		k(u, -.05),
		k(u, .04)
	]), f = k(u, -.14), p = M(n, "moss", !0) ? A(i.leaf, u, .35) : null, m = (e, t) => t.y < -.3 ? f : p && t.y > .72 && e.y > s * .55 ? p : d(e), _ = .1, v = l(1, 1);
	S(v, { rot: [
		e.range(0, 6.28),
		e.range(0, 6.28),
		0
	] }), S(v, {
		scale: [
			o / 2,
			(s + _) / 2,
			c / 2
		],
		pos: [
			0,
			(s - _) / 2,
			0
		]
	}), h(v, Math.min(o, s) * .045, e), a.add(g(v, m));
	let y = e.range(0, Math.PI * 2), b = o * .14, x = h(l(b, 0), b * .15, e);
	return a.add(S(g(x, (e, t) => t.y < -.3 ? f : d(e)), {
		pos: [
			Math.sin(y) * (o / 2 + b * .6),
			b * .7,
			Math.cos(y) * (c / 2 + b * .6)
		],
		scale: [
			1,
			.75,
			1
		]
	})), a.cylCol(0, 0, Math.max(o, c) * .47, s), a.done();
}
function Ke(e, t, n) {
	var r, i;
	let a = P(t), o = new H(), s = j(n, "length", .9, .3, 3), c = k(a.castle, -.1), l = (r = N(n, "color")) == null ? A((i = t.accents.castle) == null ? c : i, "#8C2F39", .35) : r, u = s / 2, p = s * .13;
	o.add(S(g(f(.013, .011, s - p, 4), k(a.woodDark, -.28)), {
		rot: [
			Math.PI / 2,
			0,
			0
		],
		pos: [
			0,
			0,
			-u
		]
	})), o.add(S(g(d(.04, p, 4), a.iron), {
		rot: [
			Math.PI / 2,
			0,
			0
		],
		pos: [
			0,
			0,
			u - p
		]
	}));
	let m = -u + s * .1;
	for (let t of [0, Math.PI / 2]) o.add(I(.006, .075, s * .16, F(l, .04, e), {
		pos: [
			0,
			0,
			m
		],
		rot: [
			.12,
			0,
			t + e.range(-.05, .05)
		]
	}));
	return o.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-walls.ts
function qe(e, t, n) {
	var r, i, a;
	let o = n.x1 - n.x0;
	if (o < .1 || n.height < .1) return;
	let s = (r = n.z) == null ? 0 : r, c = (i = n.y0) == null ? 0 : i, l = Math.max(1, Math.round(o / ((a = n.maxSeg) == null ? 2.6 : a))), u = o / l, d = Math.min(.2, n.height * .15), f = n.height - d, p = Te(Math.round(f / .5), 1, 4), m = f / p, g = u < 1.3 ? 2 : 3, _ = u / g, v = k(n.color, -.14);
	for (let r = 0; r < l; r++) {
		var y;
		let i = n.x0 + r * u;
		e.add(I(u, f, n.thick - .1, v, { pos: [
			i + u / 2,
			c + f / 2,
			s
		] }));
		for (let r = 0; r < p; r++) {
			let a = [0];
			for (let e = 1; e < g; e++) a.push((e - r % 2 * .5 + t.range(-.12, .12)) * _);
			a.push(u);
			for (let o = 0; o + 1 < a.length; o++) {
				let l = a[o], u = a[o + 1] - l, d = I(u - .045, m - .04, n.thick + t.range(-.02, .06), F(n.color, .07, t), {
					pos: [
						i + l + u / 2,
						c + r * m + m / 2,
						s + t.range(-.025, .025)
					],
					rot: [
						0,
						t.range(-.025, .025),
						t.range(-.02, .02)
					]
				});
				e.add(h(d, Math.min(.035, m * .07), t));
			}
		}
		let a = I(u + .04, d, n.thick + .14, F((y = n.cap) == null ? n.color : y, .03, t), {
			pos: [
				i + u / 2,
				c + f + d / 2,
				s
			],
			rot: [
				t.range(-.01, .01),
				0,
				t.range(-.012, .012)
			]
		}, .04);
		e.add(a), e.boxCol(i + u / 2, s, u, n.height, n.thick + .14, 0, c);
	}
}
function Je(e, t, n, r, i, a, o, s) {
	e.add(h(I(o, a, o, F(s, .04, t), { pos: [
		r,
		a / 2,
		i
	] }, .05), .03, t)), e.add(I(o + .16, .18, o + .16, F(n.stoneLight, .03, t), { pos: [
		r,
		a + .09,
		i
	] }, .04)), e.add(S(g(d(o * .55, o * .45, 4), F(n.stoneDark, .03, t)), {
		pos: [
			r,
			a + .18,
			i
		],
		rot: [
			0,
			Math.PI / 4,
			0
		]
	})), e.boxCol(r, i, o + .16, a + .2, o + .16);
}
function Ye(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "length", 6, 1, 80), o = j(n, "height", 1.3, .4, 7), s = j(n, "thick", .6, .3, 1.5), c = M(n, "pillars", !0) && a >= 2.5, l = s + .25, u = c ? l / 2 : 0;
	return qe(i, e, {
		x0: -a / 2 + u,
		x1: a / 2 - u,
		height: o,
		thick: s,
		color: r.wall,
		cap: r.stoneLight
	}), c && (Je(i, e, r, -a / 2 + l / 2, 0, o + .2, l, r.wall), Je(i, e, r, a / 2 - l / 2, 0, o + .2, l, r.wall)), i.done();
}
function Xe(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "length", 6, 1, 60), o = Math.round(j(n, "posts", Math.round(a / 2) + 1, 2, 41)), s = j(n, "height", 1.1, .5, 2), c = M(n, "endPost", !0), l = [];
	for (let t = 0; t < o; t++) {
		let n = -a / 2 + a * t / (o - 1), u = s + e.range(.05, .2), f = e.range(-.06, .06), p = e.range(-.05, .05), m = F(r.wood, .06, e);
		t === o - 1 && !c ? l.push([
			n,
			u,
			0
		]) : (i.add(L(.085, .11, u, m, {
			pos: [
				n,
				0,
				0
			],
			rot: [
				p,
				0,
				f
			]
		}, 6)), i.add(S(g(d(.1, .13, 6), F(r.woodDark, .03, e)), {
			pos: [
				n - Math.sin(f) * u,
				Math.cos(f) * u - .01,
				Math.sin(p) * u
			],
			rot: [
				p,
				0,
				f
			]
		})), l.push([
			n - Math.sin(f) * u,
			u,
			Math.sin(p) * u
		]));
	}
	for (let t = 0; t + 1 < o; t++) {
		let n = l[t], a = l[t + 1];
		for (let t of [.38, .8]) {
			let o = e.chance(.12) ? e.range(-.18, -.08) : e.range(-.03, .03), c = s * t + e.range(-.03, .03), l = s * t + o, u = F(r.woodLight, .05, e);
			i.add(R([
				n[0],
				c,
				n[2] * t + .06
			], [
				a[0],
				l,
				a[2] * t + .06
			], .07, u, .12));
		}
		i.boxCol((n[0] + a[0]) / 2, 0, Math.abs(a[0] - n[0]), s, .26);
	}
	return i.done();
}
function Ze(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "length", 5, 2.4, 30), o = j(n, "height", 1.2, .9, 2), s = .6;
	qe(i, e, {
		x0: -a / 2,
		x1: -.6,
		height: o,
		thick: .6,
		color: r.wall,
		cap: r.stoneLight
	}), qe(i, e, {
		x0: s,
		x1: a / 2,
		height: o,
		thick: .6,
		color: r.wall,
		cap: r.stoneLight
	}), qe(i, e, {
		x0: -.6,
		x1: s,
		height: .62,
		thick: .6,
		color: r.wall,
		cap: r.stoneLight
	});
	for (let t of [-1, 1]) i.add(L(.08, .1, o + .45, F(r.wood, .05, e), {
		pos: [
			t * .65,
			0,
			.36
		],
		rot: [
			0,
			0,
			t * .04
		]
	}, 6)), i.add(L(.08, .1, o + .45, F(r.wood, .05, e), {
		pos: [
			t * .65,
			0,
			-.36
		],
		rot: [
			0,
			0,
			t * .04
		]
	}, 6));
	for (let [t, n, a] of [
		[
			.28,
			.82,
			.34
		],
		[
			.56,
			.5,
			.32
		],
		[
			.84,
			0,
			.66
		],
		[
			.56,
			-.5,
			.32
		],
		[
			.28,
			-.82,
			.34
		]
	]) {
		let o = 1.08 + e.range(-.04, .04);
		if (i.add(I(o, .08, a, F(r.woodLight, .05, e), {
			pos: [
				0,
				t - .04,
				n
			],
			rot: [
				0,
				e.range(-.04, .04),
				0
			]
		}, .02)), t < .8) for (let e of [-1, 1]) i.add(I(.08, t - .08, .08, r.woodDark, { pos: [
			e * .42,
			(t - .08) / 2,
			n
		] }));
		i.boxCol(0, n, 1.1, t, a);
	}
	return i.done();
}
function Qe(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "length", 4, 1.5, 16), o = j(n, "width", 1.6, .8, 4), s = M(n, "rails", !0), c = .22;
	for (let e of [-1, 1]) i.add(I(.16, .16, a, r.woodDark, { pos: [
		e * (o / 2 - .18),
		.08,
		0
	] }));
	let l = Math.max(3, Math.round(a / .33)), u = a / l;
	for (let t = 0; t < l; t++) {
		let n = -a / 2 + u * (t + .5), s = I(o + e.range(-.06, .12), .07, u - .04, F(r.woodLight, .07, e), {
			pos: [
				e.range(-.05, .05),
				.185 + e.range(-.012, .012),
				n
			],
			rot: [
				0,
				e.range(-.05, .05),
				e.range(-.02, .02)
			]
		});
		i.add(s);
	}
	if (i.boxCol(0, 0, o, c, a), s) {
		let t = Math.max(2, Math.round(a / 2.2) + 1);
		for (let n of [-1, 1]) {
			let s = [];
			for (let c = 0; c < t; c++) {
				let l = -a / 2 + .15 + (a - .3) * c / (t - 1), u = n * (o / 2 + .02);
				i.add(L(.06, .075, 1.1, F(r.wood, .05, e), {
					pos: [
						u,
						0,
						l
					],
					rot: [
						e.range(-.04, .04),
						0,
						n * .05
					]
				}, 6)), s.push([
					u + n * .05,
					1,
					l
				]);
			}
			for (let e = 0; e + 1 < s.length; e++) {
				let t = s[e], n = s[e + 1], a = [
					(t[0] + n[0]) / 2,
					t[1] - .12,
					(t[2] + n[2]) / 2
				];
				i.add(R(t, a, .04, r.straw), R(a, n, .04, r.straw));
			}
			i.boxCol(n * (o / 2 + .02), 0, .12, 1.1, a, 0, c);
		}
	}
	return i.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-gates.ts
function $e(e, t, n, r, i, a) {
	let o = new H();
	o.add(I(n, r, .12, F(a, .03, t), { pos: [
		i * n / 2,
		r / 2,
		0
	] }, .02)), o.add(I(.03, r - .1, .03, e.woodDark, { pos: [
		i * n / 2,
		r / 2,
		.065
	] }));
	for (let t of [.22, .78]) o.add(I(n * .92, .1, .03, e.iron, { pos: [
		i * n / 2,
		r * t,
		.075
	] }));
	return o;
}
function et(e, t, n, r, i) {
	e.add(R([
		n,
		r - .25,
		i
	], [
		n,
		r,
		i + .28
	], .06, t.iron)), e.add(V(.1, t.iron, {
		pos: [
			n,
			r - .02,
			i + .28
		],
		scale: [
			1,
			.6,
			1
		]
	})), Re(e, t, n, r + .02, i + .28, .07);
}
function tt(e, t, n, r, i, a) {
	e.add(L(.04, .05, r, a.woodDark, { pos: n }, 5)), e.add(V(.07, a.gold, { pos: [
		n[0],
		n[1] + r + .04,
		n[2]
	] }));
	let o = n[1] + r - .08, s = t.range(.15, .35);
	e.add(z([
		[0, -.42],
		[.55, -.32],
		[.55, -.08],
		[0, 0]
	], .03, i, {
		pos: [
			n[0],
			o,
			n[2]
		],
		rot: [
			0,
			s,
			0
		]
	}));
	let c = n[0] + Math.cos(s) * .55, l = n[2] - Math.sin(s) * .55;
	e.add(z([
		[0, -.32],
		[.5, -.2],
		[0, -.08]
	], .03, F(i, .06, t), {
		pos: [
			c,
			o,
			l
		],
		rot: [
			0,
			s - t.range(.35, .6),
			0
		]
	}));
}
function nt(e, t, n, r, i) {
	let a = Math.cos(i), o = Math.sin(i);
	return [e + a * n + o * r, t - o * n + a * r];
}
function rt(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "width", 3.4, 2, 6), o = j(n, "height", 3.2, 2, 7), s = M(n, "open", !0), c = 1.9, l = j(n, "length", 12, 0, 80), u = Math.min(3, Math.max(2.2, o * .7)), d = a / 2 * .6, f = Math.max(o, u + d + .45), p = f + 1.3, m = 1.65;
	for (let t of [-1, 1]) {
		let n = t * (a / 2 + c / 2), o = p / 3;
		for (let t = 0; t < 3; t++) {
			let a = I(c + e.range(-.04, .06), o, c + e.range(-.04, .06), F(r.wall, .06, e), {
				pos: [
					n + e.range(-.03, .03),
					o * (t + .5),
					e.range(-.03, .03)
				],
				rot: [
					0,
					e.range(-.025, .025),
					0
				]
			});
			i.add(h(a, .03, e));
		}
		i.add(I(2.1999999999999997, .26, 2.1999999999999997, F(r.stoneLight, .03, e), { pos: [
			n,
			p + .13,
			0
		] }));
		for (let t of [-1, 1]) for (let a of [-1, 1]) {
			let o = I(.5, .45, .5, F(r.wall, .05, e), { pos: [
				n + t * (c / 2 - .12),
				p + .48,
				a * (c / 2 - .12)
			] });
			i.add(o);
		}
		i.add(I(.5, .7, .06, r.woodDark, { pos: [
			n,
			p - 1,
			.97
		] })), i.glow(I(.36, .56, .05, r.windowGlow, { pos: [
			n,
			p - 1,
			.99
		] })), et(i, r, n - t * (c / 2 - .25), u - .4, c / 2), tt(i, e, [
			n,
			p + .26,
			0
		], 1.4, e.pick(r.cloth), r), i.boxCol(n, 0, 2, p, 2);
	}
	let g = [
		[-a / 2, f],
		...B(0, u, a / 2, d, Math.PI, 0, 8),
		[a / 2, f]
	], _ = F(r.wall, .03, e), v = r.stoneLight, y = (e) => Math.floor(Math.atan2((e.y - u) / d, e.x / (a / 2)) / Math.PI * 7) % 2 == 0 ? _ : v;
	i.add(z(g, m, (e, t) => Math.abs(t.z) > .5 || e.y > f - .05 ? _ : y(e)));
	let b = [...B(0, u, a / 2 + .38, d + .38, Math.PI, 0, 7), ...B(0, u, a / 2, d, 0, Math.PI, 7)];
	i.add(z(b, .12, y, { pos: [
		0,
		0,
		.865
	] })), i.boxCol(0, 0, a, f - u, m, 0, u);
	let x = a / 2, S = u + d * .45, C = m / 2 - .08, w = s ? Math.PI / 2 + .12 : 0;
	for (let t of [-1, 1]) {
		let n = t === -1 ? 1 : -1, o = t === -1 ? -w : w;
		i.absorb($e(r, e, x, S, n, r.gate), {
			pos: [
				a / 2 * t,
				0,
				C
			],
			rotY: o
		});
		let [s, c] = nt(a / 2 * t, C, n * x / 2, 0, o);
		i.boxCol(s, c, x, S, .16, o);
	}
	if (l / 2 - (a / 2 + c) > .4) {
		let t = {
			height: o,
			thick: .7,
			color: r.wall,
			cap: r.stoneLight
		};
		qe(i, e, {
			...t,
			x0: -l / 2,
			x1: -(a / 2 + c)
		}), qe(i, e, {
			...t,
			x0: a / 2 + c,
			x1: l / 2
		});
	}
	return i.done();
}
function it(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "length", 12, 3, 80), o = j(n, "height", 4.2, 3, 8), s = M(n, "open", !1), c = .95, l = 1.25, u = 1.85, f = .42, p = 2.75, m = {
		height: o,
		thick: .8,
		color: r.wall,
		cap: r.stoneLight
	};
	qe(i, e, {
		...m,
		x0: -a / 2,
		x1: -.95
	}), qe(i, e, {
		...m,
		x0: c,
		x1: a / 2
	}), qe(i, e, {
		...m,
		x0: -.95,
		x1: c,
		y0: p,
		height: o - p,
		maxSeg: 2
	});
	let _ = [
		[-.95, 0],
		[-.95, p],
		[c, p],
		[c, 0],
		[l / 2, 0],
		...B(0, u, l / 2, f, 0, Math.PI, 6),
		[-1.25 / 2, 0]
	];
	i.add(h(z(_, .9600000000000001, F(r.stoneLight, .03, e)), .02, e)), i.add(I(.34, .42, 1.04, r.stoneLight, { pos: [
		0,
		2.39,
		0
	] }, .03)), i.boxCol(-1.575 / 2, 0, c - l / 2, p, .9600000000000001), i.boxCol(1.575 / 2, 0, c - l / 2, p, .9600000000000001);
	let v = new H(), y = [
		[0, 0],
		[l, 0],
		...B(l / 2, u, l / 2, f, 0, Math.PI, 6)
	];
	v.add(z(y, .12, F(r.gate, .02, e)));
	for (let e of [
		.25,
		.5,
		.75
	]) {
		let t = l * e, n = u + f * Math.sqrt(1 - ((t - l / 2) / (l / 2)) ** 2) - .06;
		v.add(I(.03, n - .06, .03, r.woodDark, { pos: [
			t,
			n / 2,
			.07
		] }));
	}
	for (let e of [.4, 1.55]) v.add(I(l * .7, .09, .03, r.iron, { pos: [
		l * .35,
		e,
		.08
	] }));
	v.add(L(.07, .07, .03, r.iron, {
		pos: [
			l * .72,
			1.1,
			.07
		],
		rot: [
			Math.PI / 2,
			0,
			0
		]
	}, 8)), v.add(I(.26, .2, .03, r.hollow, { pos: [
		l / 2,
		1.62,
		.065
	] })), v.add(I(.03, .2, .04, r.iron, { pos: [
		l / 2,
		1.62,
		.08
	] }));
	let b = [
		-1.25 / 2,
		0,
		s ? -.05 : .02
	], x = s ? Math.PI / 2 - .2 : 0;
	if (i.absorb(v, {
		pos: b,
		rotY: x
	}), !s) i.boxCol(0, 0, l, 2.27, .3);
	else {
		let [e, t] = nt(b[0], b[2], l / 2, 0, x);
		i.boxCol(e, t, l, 2.27, .16, x);
	}
	for (let t of [-1, 1]) i.add(I(.62, .08, .72, F(r.gate, .04, e), {
		pos: [
			t * .27,
			2.97,
			.78
		],
		rot: [
			0,
			0,
			-t * .55
		]
	}, .02)), i.add(R([
		t * .5,
		2.5,
		.48000000000000004
	], [
		t * .5,
		2.8,
		1.03
	], .07, r.woodDark));
	let C = 1.2999999999999998;
	i.add(R([
		C,
		2.35,
		.44000000000000006
	], [
		C,
		2.55,
		.8800000000000001
	], .06, r.iron)), i.add(S(g(d(.17, .16, 4), r.iron), {
		pos: [
			C,
			2.3,
			.8800000000000001
		],
		rot: [
			0,
			Math.PI / 4,
			0
		]
	})), i.add(I(.24, .04, .24, r.iron, { pos: [
		C,
		1.98,
		.8800000000000001
	] }));
	for (let e of [-1, 1]) for (let t of [-1, 1]) i.add(I(.03, .3, .03, r.iron, { pos: [
		C + e * .1,
		2.14,
		.8800000000000001 + t * .1
	] }));
	return i.glow(I(.17, .26, .17, r.windowGlow, { pos: [
		C,
		2.14,
		.8800000000000001
	] })), i.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-towers.ts
function at(e, t, n) {
	return {
		pos: [
			Math.sin(e) * t,
			n,
			Math.cos(e) * t
		],
		rotY: e
	};
}
function ot(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "height", 12, 6, 30), o = j(n, "radius", 2.2, 1.2, 5), s = r.palace, c = r.palaceRoof, l = k(s, -.07), u = a * .86;
	i.add(g(p([
		[o + .4, -.1],
		[o + .3, .55],
		[o, .7]
	], 10), l)), i.add(g(p([[o, .6], [o * .94, a * .72]], 10), ze([s, F(s, .03, e)]))), i.add(L(o * .97 + .12, o * .97 + .12, .26, l, { pos: [
		0,
		a * .45,
		0
	] }, 10)), i.add(g(p([
		[o * .94, a * .72],
		[o * 1.12, a * .76],
		[o * 1.12, u],
		[o * .9, u]
	], 10), (e) => e.y < a * .755 ? l : s));
	let f = p([
		[o * 1.32, u],
		[o * 1.02, u + .55],
		[o * .56, u + 2],
		[0, u + 4.6]
	], 10);
	i.add(g(f, (e) => Math.floor((e.y - u) / .7) % 2 == 0 ? c : k(c, .06))), tt(i, e, [
		0,
		u + 4.45,
		0
	], 1.6, r.gold, r);
	let m = [
		[a * .3, [
			.5,
			-.5,
			Math.PI / 2 + .3
		]],
		[a * .58, [
			0,
			1.3,
			-1.3
		]],
		[a * .81, [.35, -.35]]
	];
	for (let [e, t] of m) {
		let n = e < a * .72 ? o - o * .06 * (e - .6) / (a * .72 - .6) : o * 1.12;
		for (let a of t) {
			let t = new H();
			t.add(I(.62, .95, .1, c, {})), t.glow(I(.42, .72, .08, r.windowGlow, { pos: [
				0,
				-.04,
				.03
			] }));
			let o = S(g(d(.42, .34, 4), c), { rot: [
				0,
				Math.PI / 4,
				0
			] });
			t.add(S(o, {
				pos: [
					0,
					.47,
					.02
				],
				scale: [
					1,
					1,
					.35
				]
			})), i.absorb(t, at(a, n + .01, e));
		}
	}
	let h = [
		[-.55, 0],
		[.55, 0],
		...B(0, 1.5, .55, .45, 0, Math.PI, 5)
	];
	return i.add(z(h, .16, c, {
		pos: [
			0,
			.55,
			o - .02
		],
		scale: [
			1.25,
			1.1,
			1
		]
	})), i.add(z(h, .2, F(r.wood, .03, e), { pos: [
		0,
		.55,
		o + .02
	] })), i.add(V(.06, r.brass, { pos: [
		.3,
		1.3,
		o + .13
	] })), i.cylCol(0, 0, o + .35, a), i.done();
}
function st(e, t, n) {
	var r, i;
	let a = P(t), o = new H(), s = j(n, "height", 16, 6, 40), c = j(n, "radius", 3, 1.5, 8), l = M(n, "glow", !1), u = a.castle, f = [
		u,
		k(u, -.04),
		k(u, .04)
	], m = p([
		[c * 1.18, -.3],
		[c, s * .16],
		[c * .86, s * .82]
	], 6);
	o.add(h(g(m, ze(f)), c * .05, e));
	let _ = p([
		[c * .86, s * .82],
		[c * 1.06, s * .86],
		[c * 1.06, s * .9],
		[c * .78, s * .9]
	], 6);
	o.add(h(g(_, k(u, .03)), c * .03, e));
	for (let t = 0; t < 6; t++) {
		if (e.chance(.15)) continue;
		let n = t / 6 * Math.PI * 2 + Math.PI / 6;
		o.add(I(c * .42, c * .32, .5, F(u, .04, e), {
			pos: [
				Math.sin(n) * c * .92,
				s * .9 + c * .16,
				Math.cos(n) * c * .92
			],
			rot: [
				0,
				n,
				e.range(-.06, .06)
			]
		}));
	}
	let v = new H();
	v.add(L(c * .36, c * .42, s * .22, ze(f), {}, 6)), v.add(S(g(d(c * .55, s * .24, 6), k(u, -.08)), { pos: [
		0,
		s * .22,
		0
	] })), o.absorb(v, {
		pos: [
			c * .32,
			s * .88,
			-c * .25
		],
		lean: [.12 * e.sign(), .05]
	});
	let y = l ? (r = (i = t.accents.embers) == null ? t.accents.fire : i) == null ? "#B5523B" : r : a.hollow;
	for (let t = 0; t < 4; t++) {
		let n = e.range(-.7, .7), r = s * (.25 + t * .15) + e.range(-.4, .4), i = c - c * .14 * (r - s * .16) / (s * .66) - .05, a = I(.26, 1.1, .4, y, {
			rot: [
				0,
				n,
				0
			],
			pos: [
				Math.sin(n) * i,
				r,
				Math.cos(n) * i
			]
		});
		l ? o.glow(a) : o.add(a);
	}
	return tt(o, e, [
		-c * .4,
		s * .9 + .2,
		c * .3
	], 2.4, k(u, -.1), a), o.cylCol(0, 0, c * 1.15, s), o.done();
}
function ct(e, t, n) {
	let r = e.getAttribute("position");
	for (let e = 0; e < r.count; e++) {
		let i = Math.max(0, r.getY(e)) / n;
		r.setZ(e, r.getZ(e) + t * n * i * i);
	}
	return r.needsUpdate = !0, e.computeVertexNormals(), e.computeBoundingBox(), e.computeBoundingSphere(), e;
}
function lt(e, t, n) {
	var r;
	let i = P(t), a = new H(), o = j(n, "height", 90, 10, 300), s = j(n, "radius", 45, 5, 200), c = j(n, "lean", .35, -1, 1), l = (r = N(n, "color")) == null ? i.mountain : r, u = k(l, -.05), d = A(l, t.sky.horizon, .18), f = k(l, -.12), m = ze([
		l,
		F(l, .05, e),
		k(l, .03)
	]), _ = (e, t) => {
		if (t.y < -.05) return f;
		let n = e.y / o;
		return n < .3 ? u : n > .7 ? d : m(e);
	}, v = p([
		[s, -2],
		[s * .72, o * .3],
		[s * .42, o * .65],
		[s * .13, o * .92],
		[0, o]
	], 7);
	h(v, s * .07, e), ct(v, c, o), a.add(g(v, _));
	let y = o * .55, b = p([
		[s * .5, -2],
		[s * .32, y * .5],
		[0, y]
	], 6);
	return h(b, s * .05, e), ct(b, c * .6, o), a.add(S(g(b, _), {
		pos: [
			s * .55 * e.sign(),
			0,
			-s * .3
		],
		rot: [
			0,
			e.range(0, 1),
			0
		]
	})), a.cylCol(0, 0, s * .8, o * .5), a.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-chapter-town.ts
function ut(e, t, n, r, i, a, o, s, c = 1) {
	let l = Math.max(1, Math.floor((i - r) / c)), u = (i - r) / l;
	for (let i = 0; i < l; i++) {
		if (t.chance(.12)) continue;
		let c = r + u * (i + .5);
		e.add(h(I(u * .52, .42 + t.range(-.05, .08), s * .9, F(n, .06, t), {
			pos: [
				c,
				a + .2,
				o + t.range(-.02, .02)
			],
			rot: [
				0,
				t.range(-.03, .03),
				t.range(-.03, .03)
			]
		}), .02, t));
	}
}
function dt(e, t, n) {
	var r;
	let i = P(t), a = new H(), o = j(n, "length", 8, 2, 80), s = j(n, "height", 3.2, 1.2, 8), c = j(n, "thick", .8, .4, 2), l = M(n, "crenels", !0), u = (r = N(n, "color")) == null ? i.wall : r, d = o < 5 ? 1 : o < 11 ? 2 : 3, f = o / d;
	for (let t = 0; t < d; t++) {
		let n = -o / 2 + f * t, r = n + f, p = s + (d > 1 ? e.range(-.2, .22) : 0), m = d > 1 ? e.range(-.08, .08) : 0;
		if (qe(a, e, {
			x0: n,
			x1: r,
			z: m,
			height: p,
			thick: c,
			color: u,
			cap: i.stoneLight
		}), l && ut(a, e, u, n + .1, r - .1, p, m, c), t > 0) {
			let t = c * .7;
			a.add(h(I(t, p * .72, c * .55, F(i.stoneDark, .04, e), {
				pos: [
					n,
					p * .36,
					c / 2 + c * .22
				],
				rot: [
					-.14,
					0,
					0
				]
			}), .025, e)), a.add(I(t + .1, .12, c * .6, i.stoneLight, { pos: [
				n,
				p * .7,
				c / 2 + c * .14
			] }, .03));
		}
	}
	return a.done();
}
function ft(e, t, n) {
	return rt(e, t, {
		width: 4,
		height: 4,
		length: 14,
		open: !0,
		...n
	});
}
function pt(e, t, n) {
	return lt(e, t, {
		height: 110,
		radius: 50,
		lean: .55,
		...n
	});
}
function mt(e, t, n, r, i, a, o, s) {
	let c = new H(), l = F(t.wood, .04, e);
	c.add(h(I(n, r, i, a, { pos: [
		0,
		r / 2,
		0
	] }, .05), .02, e));
	for (let e of [-1, 1]) c.add(I(.16, r, .16, l, { pos: [
		n / 2 * e,
		r / 2,
		i / 2 - .08
	] }));
	c.add(I(n + .1, .14, .14, l, { pos: [
		0,
		r - .07,
		i / 2
	] })), c.add(I(n + .1, .14, .14, l, { pos: [
		0,
		r * .5,
		i / 2
	] }));
	for (let e of [-1, 1]) {
		let a = new H();
		a.add(I(.62, .72, .06, t.woodDark, {}));
		let o = I(.48, .58, .05, s ? t.windowGlow : t.glass, { pos: [
			0,
			0,
			.02
		] });
		s ? a.glow(o) : a.add(o), a.add(I(.05, .58, .03, t.woodDark, { pos: [
			0,
			0,
			.05
		] })), a.add(I(.72, .08, .14, t.woodLight, { pos: [
			0,
			-.4,
			.04
		] })), c.absorb(a, { pos: [
			e * n * .26,
			r * .74,
			i / 2 + .03
		] });
	}
	let u = .95, d = n / 2 * Math.tan(u), f = [
		[-n / 2, 0],
		[n / 2, 0],
		[0, d]
	];
	c.add(z(f, i, a, { pos: [
		0,
		r,
		0
	] }));
	let p = (n / 2 + .3) / Math.cos(u);
	for (let t of [-1, 1]) c.add(I(p, .14, i + .5, F(o, .05, e), {
		pos: [
			t * (n / 4 + .08),
			r + d / 2 + .1,
			0
		],
		rot: [
			0,
			0,
			-t * u
		]
	}));
	return c.add(I(.2, .2, i + .6, t.woodDark, {
		pos: [
			0,
			r + d + .1,
			0
		],
		rot: [
			0,
			0,
			Math.PI / 4
		]
	})), c;
}
function ht(e, t, n) {
	var r;
	let i = P(t), a = new H(), o = j(n, "width", 3, 1.8, 6), s = M(n, "lit", !0), c = (r = N(n, "door")) == null ? i.gate : r, l = [
		2.4,
		3.3,
		2.7
	], u = [
		-o - .1,
		0,
		o + .1
	];
	for (let t = 0; t < 3; t++) {
		let n = i.plaster[(t * 2 + 1) % i.plaster.length], r = i.roof[t % i.roof.length], c = mt(e, i, o, l[t], 1.1, n, r, s && e.chance(.85));
		a.absorb(c, {
			pos: [
				u[t],
				0,
				0
			],
			lean: [e.range(-.025, .025), 0],
			rotY: e.range(-.04, .04)
		});
	}
	let d = 1.5, f = 1.9, p = .55, m = [
		[-1.5 / 2, 0],
		[d / 2, 0],
		...B(0, f, d / 2, p, 0, Math.PI, 7)
	], g = [
		...B(0, f, .97, .77, 0, Math.PI, 7),
		[-1.5 / 2 - .22, 0],
		[-1.5 / 2, 0],
		...B(0, f, d / 2, p, Math.PI, 0, 7),
		[.97, 0]
	];
	a.add(z(g, .2, F(i.stoneLight, .03, e), { pos: [
		0,
		0,
		.6100000000000001
	] })), a.add(z(m, .12, F(c, .03, e), { pos: [
		0,
		0,
		.67
	] }));
	for (let e of [.5, 1.4]) a.add(I(d * .76, .09, .03, i.iron, { pos: [
		0,
		e,
		.75
	] }));
	a.add(I(.04, 2.35, .03, i.woodDark, { pos: [
		0,
		2.45 / 2,
		.75
	] })), a.add(V(.07, i.brass, { pos: [
		d * .3,
		1.1,
		.77
	] })), s && a.glow(I(.3, .22, .03, i.windowGlow, { pos: [
		0,
		2.02,
		.74
	] })), a.add(h(I(2.3, .2, .7, F(i.stone, .04, e), { pos: [
		0,
		.06,
		.9500000000000001
	] }, .04), .02, e));
	for (let t = 0; t < 8; t++) {
		let n = -1.5 * o + 3 * o * ((t + .5) / 8) + e.range(-.15, .15);
		Math.abs(n) < 1.35 || (a.add(V(.14, i.leafDark, {
			pos: [
				n,
				.1,
				.8500000000000001
			],
			scale: [
				1.2,
				.7,
				1
			]
		})), a.add(V(.09, e.pick(i.blossom), { pos: [
			n,
			.24,
			.8700000000000001
		] })));
	}
	return a.boxCol(0, 0, 3 * o + .4, l[1] + .5, 1.4000000000000001), a.done();
}
function gt(e, t, n) {
	var r;
	let i = P(t), a = new H(), o = j(n, "width", 20, 8, 80), s = j(n, "height", 16, 6, 40), c = M(n, "glow", !1), l = (r = N(n, "color")) == null ? i.castle : r, u = [
		{
			x: -o / 2 + 2.6,
			z: e.range(-1, 1),
			h: s * .82,
			r: 2.4
		},
		{
			x: e.range(-1.5, 1.5),
			z: -e.range(.5, 2),
			h: s,
			r: 3
		},
		{
			x: o / 2 - 2.6,
			z: e.range(-1, 1),
			h: s * .7,
			r: 2.1
		}
	];
	for (let n of u) {
		let r = st(e.fork(`tower@${n.x.toFixed(1)}`), t, {
			height: n.h,
			radius: n.r,
			glow: c
		}), i = e.range(0, Math.PI * 2), o = (e) => (e.rotateY(i), e.translate(n.x, 0, n.z), e);
		a.add(o(r.geometry)), r.glow && a.glow(o(r.glow)), a.cylCol(n.x, n.z, n.r * 1.15, n.h);
	}
	let d = s * .42, f = 2.2, p = _t(l, e);
	for (let n = 0; n + 1 < u.length; n++) {
		let r = u[n], i = u[n + 1], o = r.x + r.r * .6, s = i.x - i.r * .6, _ = s - o, v = (r.z + i.z) / 2, y = Math.atan2(r.z - i.z, _), b = new H();
		if (b.add(h(I(_, d, f, p, { pos: [
			0,
			d / 2,
			0
		] }), .08, e)), b.add(I(_ + .3, .3, 2.6, k(l, .04), { pos: [
			0,
			d + .15,
			0
		] })), ut(b, e, l, -_ / 2, _ / 2, d + .3, f * .28, f * .4, 1.6), c) {
			var m, g;
			let e = (m = (g = t.accents.embers) == null ? t.accents.fire : g) == null ? "#B5523B" : m;
			for (let t = 0; t < 2; t++) b.glow(I(.3, .9, .3, e, { pos: [
				(t - .5) * _ * .4,
				d * .55,
				f / 2
			] }));
		}
		a.absorb(b, {
			pos: [
				(o + s) / 2,
				0,
				v
			],
			rotY: y
		}), a.boxCol((o + s) / 2, v, _, d + .5, 2.6, y);
	}
	return a.add(h(I(o + 4, 2.2, 9, A(l, i.stoneDark, .5), { pos: [
		0,
		.1,
		-.5
	] }, .6), .3, e)), a.done();
}
function _t(e, t) {
	return F(k(e, -.02), .04, t);
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-house-kit.ts
function vt(e, t) {
	let n = new H(), { w: r, d: i, h: a, timber: o } = t;
	n.add(h(I(r, a, i, t.plaster, { pos: [
		0,
		a / 2,
		0
	] }, .05), .025, e)), n.add(I(r + .1, .16, i + .1, o, { pos: [
		0,
		.08,
		0
	] })), n.add(I(r + .12, .16, i + .12, F(o, .03, e), { pos: [
		0,
		a - .08,
		0
	] }));
	for (let e of [-1, 1]) for (let t of [-1, 1]) n.add(I(.17, a, .17, o, { pos: [
		r / 2 * e,
		a / 2,
		i / 2 * t
	] }));
	let s = .16, c = a - .16, l = i / 2 + .035, u = r / 2 + .035;
	if (t.braces) for (let e of [-1, 1]) n.add(R([
		e * (r / 2 - .1),
		s,
		l
	], [
		e * (r / 2 - .75),
		c,
		l
	], .13, o, .06)), n.add(R([
		e * u,
		s,
		-i / 2 + .12
	], [
		e * u,
		c,
		-i / 2 + .85
	], .06, o, .13));
	else for (let e of [-1, 1]) n.add(I(.13, a - .3, .06, o, { pos: [
		e * r * .25,
		a / 2,
		l
	] })), n.add(I(.06, a - .3, .13, o, { pos: [
		e * u,
		a / 2,
		0
	] }));
	return n.add(I(.13, a - .3, .06, o, { pos: [
		0,
		a / 2,
		-l
	] })), n;
}
function yt(e, t, n, r, i, a = .03) {
	switch (e) {
		case "front": return {
			pos: [
				r,
				i,
				n / 2 + a
			],
			rotY: 0
		};
		case "back": return {
			pos: [
				-r,
				i,
				-n / 2 - a
			],
			rotY: Math.PI
		};
		case "right": return {
			pos: [
				t / 2 + a,
				i,
				-r
			],
			rotY: Math.PI / 2
		};
		case "left": return {
			pos: [
				-t / 2 - a,
				i,
				r
			],
			rotY: -Math.PI / 2
		};
	}
}
function U(e, t, n, r, i, a, o, s, c = {}) {
	var l, u, d, f;
	let p = (l = c.ww) == null ? .55 : l, m = (u = c.wh) == null ? .66 : u, h = new H();
	h.add(I(p + .16, m + .16, .06, t.woodDark, {}));
	let g = n.chance((d = c.lit) == null ? .85 : d), _ = I(p, m, .04, g ? t.windowGlow : t.glass, { pos: [
		0,
		0,
		.03
	] });
	if (g ? h.glow(_) : h.add(_), h.add(I(.05, m, .03, t.woodDark, { pos: [
		0,
		0,
		.06
	] })), h.add(I(p, .05, .03, t.woodDark, { pos: [
		0,
		0,
		.06
	] })), ((f = c.sill) == null || f) && h.add(I(p + .26, .08, .16, t.woodLight, { pos: [
		0,
		-m / 2 - .1,
		.05
	] })), c.shutter) {
		let e = n.sign();
		h.add(I(p * .5, m + .08, .04, F(t.woodLight, .06, n), {
			pos: [
				e * (p / 2 + p * .25 + .1),
				-.03,
				.04
			],
			rot: [
				0,
				0,
				n.range(-.22, .22)
			]
		}));
	}
	let v = yt(r, i, a, o, s);
	e.absorb(h, v);
}
function bt(e, t, n, r, i, a, o = .95, s = 1.95) {
	let c = i / 2;
	e.add(I(o + .22, s + .12, .1, t.woodDark, { pos: [
		r,
		(s + .12) / 2,
		c + .01
	] })), e.add(I(o, s, .08, F(a, .04, n), { pos: [
		r,
		s / 2,
		c + .06
	] }, .02));
	for (let n of [.25, .75]) e.add(I(o * .72, .07, .03, t.iron, { pos: [
		r - o * .12,
		s * n,
		c + .11
	] }));
	e.add(V(.05, t.brass, { pos: [
		r + o * .36,
		s * .48,
		c + .13
	] })), n.chance(.6) && e.glow(I(.2, .2, .03, t.windowGlow, { pos: [
		r,
		s * .8,
		c + .1
	] })), e.add(h(I(o + .5, .18, .5, F(t.stone, .04, n), { pos: [
		r,
		.04,
		c + .3
	] }, .03), .02, n));
}
function xt(e, t, n) {
	let r = new H(), i = Math.tan(n.pitch), a = n.w / 2 * i, o = [
		[-n.w / 2, 0],
		[n.w / 2, 0],
		[0, a]
	];
	r.add(z(o, n.d, n.gable));
	let s = (n.w / 2 + n.over) / Math.cos(n.pitch) / n.rows, c = n.d + 2 * n.over;
	for (let t of [-1, 1]) {
		let i = t * Math.sin(n.pitch), o = Math.cos(n.pitch);
		for (let u = 0; u < n.rows; u++) {
			var l;
			let d = s * (u + .5), f = n.thick / 2 + u * .03;
			r.add(I(s + .12, n.thick, c + e.range(-.04, .06), F(n.color, .05, e), {
				pos: [
					t * d * Math.cos(n.pitch) + i * f,
					a - d * Math.sin(n.pitch) + o * f,
					e.range(-.03, .03)
				],
				rot: [
					e.range(-.015, .015),
					0,
					-t * n.pitch
				]
			}, (l = n.bevel) == null ? 0 : l));
		}
	}
	let u = a + n.thick * .8;
	n.roundRidge ? r.add(L(n.thick * .9, n.thick * .9, c + .1, F(n.color, .04, e), {
		pos: [
			0,
			u,
			-(c + .1) / 2
		],
		rot: [
			Math.PI / 2,
			0,
			0
		]
	}, 6)) : r.add(I(n.thick * 1.5, n.thick * 1.5, c + .1, t.woodDark, {
		pos: [
			0,
			u,
			0
		],
		rot: [
			0,
			0,
			Math.PI / 4
		]
	}));
	let d = n.d / 2 + .03, f = a * .64;
	return r.add(I(n.w * .36 + .1, .12, .06, t.woodDark, { pos: [
		0,
		f,
		d
	] })), r.add(I(.12, a - f, .06, t.woodDark, { pos: [
		0,
		(a + f) / 2,
		d
	] })), r;
}
function St(e, t) {
	return (e.w / 2 - Math.abs(t)) * Math.tan(e.pitch);
}
function Ct(e, t, n, r = .62) {
	var i;
	let a = new H();
	return a.add(h(I(r, n, r, F(t.stone, .05, e), { pos: [
		0,
		n / 2,
		0
	] }, .04), .03, e)), a.add(I(r + .14, .16, r + .14, t.stoneDark, { pos: [
		0,
		n - .06,
		0
	] })), a.add(L(.12, .15, .3, F((i = t.roof[0]) == null ? t.stoneDark : i, .04, e), { pos: [
		e.range(-.08, .08),
		n + .02,
		0
	] }, 6)), a;
}
function wt(e, t, n, r, i, a) {
	e.add(I(.78, .18, .2, t.woodLight, { pos: [
		r,
		i,
		a + .1
	] }));
	for (let o = 0; o < 4; o++) {
		let s = r - .27 + o * .18 + n.range(-.03, .03);
		e.add(V(.08, t.leafDark, {
			pos: [
				s,
				i + .13,
				a + .1
			],
			scale: [
				1,
				.7,
				1
			]
		})), e.add(V(.06, n.pick(t.blossom), { pos: [
			s,
			i + .22,
			a + .12
		] }));
	}
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-yard.ts
function Tt(e, t, n = 1) {
	let r = [
		[0, 0],
		[.31, 0],
		[.33, .1],
		[.35, .16],
		[.39, .45],
		[.35, .74],
		[.33, .8],
		[.31, .9],
		[0, .9]
	], i = F(t.wood, .05, e), a = F(t.woodLight, .05, e);
	return S(g(p(r, 8), (e, n) => {
		if (n.y > .9) return t.woodDark;
		if (e.y > .1 && e.y < .16 || e.y > .74 && e.y < .8) return t.iron;
		let r = Math.atan2(e.z, e.x) + Math.PI;
		return Math.floor(r / (Math.PI * 2) * 8) % 2 == 0 ? i : a;
	}), {
		rot: [
			0,
			e.range(0, Math.PI),
			0
		],
		scale: n
	});
}
function Et(e, t, n) {
	let r = P(t), i = new H(), a = .55, o = .8, s = p([
		[o, 0],
		[.8400000000000001, .4],
		[o, .78],
		[.75, .85],
		[.5900000000000001, .85],
		[a, .78],
		[a, .3]
	], 9), c = [
		r.stone,
		r.stoneLight,
		r.stoneDark,
		F(r.stone, .06, e)
	];
	i.add(h(g(s, ze(c)), .03, e)), i.add(L(a, a, .02, r.water, { pos: [
		0,
		.42,
		0
	] }, 9));
	for (let t of [-1, 1]) i.add(I(.14, 2, .14, F(r.wood, .05, e), {
		pos: [
			t * .78,
			1,
			0
		],
		rot: [
			0,
			0,
			t * .03
		]
	}));
	i.add(Fe([
		-.8 - .05,
		1.55,
		0
	], [
		1.1,
		1.55,
		0
	], .06, r.woodDark, 6)), i.add(R([
		1.1,
		1.55,
		0
	], [
		1.1,
		1.38,
		.22
	], .05, r.iron)), i.add(I(.03, .55, .03, r.straw, { pos: [
		.05,
		1.27,
		0
	] })), i.add(L(.15, .12, .22, F(r.woodLight, .04, e), { pos: [
		.05,
		.78,
		0
	] }, 7));
	let l = e.pick(r.roof);
	for (let t of [-1, 1]) i.add(I(2.1, .08, .82, F(l, .04, e), {
		pos: [
			0,
			2.12,
			t * .32
		],
		rot: [
			t * .62,
			0,
			e.range(-.02, .02)
		]
	}, .02));
	return i.cylCol(0, 0, .8500000000000001, .85), i.done();
}
function Dt(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "length", 1.6, .8, 4), o = M(n, "back", !0);
	i.add(I(a, .08, .42, F(r.woodLight, .04, e), {
		pos: [
			0,
			.46,
			0
		],
		rot: [
			0,
			0,
			e.range(-.015, .015)
		]
	}, .02));
	for (let t of [-1, 1]) i.add(I(.08, .42, .38, F(r.wood, .04, e), { pos: [
		t * (a / 2 - .2),
		.21,
		0
	] }));
	if (i.add(R([
		-(a / 2 - .2),
		.12,
		0
	], [
		a / 2 - .2,
		.12,
		0
	], .06, r.woodDark)), o) {
		for (let e of [-1, 1]) i.add(I(.07, .52, .06, r.wood, {
			pos: [
				e * (a / 2 - .22),
				.7,
				-.2
			],
			rot: [
				-.12,
				0,
				0
			]
		}));
		i.add(I(a - .1, .18, .05, F(r.woodLight, .04, e), {
			pos: [
				0,
				.86,
				-.23
			],
			rot: [
				-.12,
				0,
				0
			]
		}, .015));
	}
	return i.boxCol(0, 0, a, .5, .46), i.done();
}
function Ot(e, t, n) {
	let r = new H(), i = j(n, "scale", 1, .4, 3);
	return r.add(Tt(e, P(t), i)), r.cylCol(0, 0, .4 * i, .9 * i), r.done();
}
function kt(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "size", .8, .3, 2), o = Math.round(j(n, "stack", 1, 1, 3)), s = a, c = 0;
	for (let t = 0; t < o; t++) {
		let t = new H(), n = F(r.woodLight, .06, e);
		t.add(I(a, a, a, n, { pos: [
			0,
			a / 2,
			0
		] }, .04));
		for (let e of [-1, 1]) {
			let n = e * (a / 2 + .015);
			t.add(I(a - .04, .1, .03, r.wood, { pos: [
				0,
				.07,
				n
			] })), t.add(I(a - .04, .1, .03, r.wood, { pos: [
				0,
				a - .07,
				n
			] })), t.add(R([
				-a / 2 + .08,
				.1,
				n
			], [
				a / 2 - .08,
				a - .1,
				n
			], .08, r.wood, .03));
		}
		t.add(I(a + .03, .1, a + .03, r.woodDark, { pos: [
			0,
			a / 2,
			0
		] })), i.absorb(t, {
			pos: [
				e.range(-.06, .06),
				c,
				e.range(-.06, .06)
			],
			rotY: e.range(-.3, .3)
		}), c += a, a *= e.range(.75, .9);
	}
	return i.boxCol(0, 0, s, c, s), i.done();
}
function At(e, t, n) {
	let r = P(t), i = new H(), a = F(r.woodLight, .05, e);
	i.add(I(1.2, .12, 1.8, a, { pos: [
		0,
		.62,
		0
	] }, .02));
	for (let t of [-1, 1]) i.add(I(.06, .32, 1.8, F(r.wood, .04, e), { pos: [
		t * .6,
		.8200000000000001,
		0
	] }));
	i.add(I(1.2, .32, .06, r.wood, { pos: [
		0,
		.8200000000000001,
		.9
	] })), i.add(I(1.2, .22, .06, r.wood, { pos: [
		0,
		.77,
		-.9
	] }));
	for (let t of [-1, 1]) {
		let n = t * .72;
		i.add(L(.45, .45, .1, F(r.wood, .04, e), {
			pos: [
				n + t * .05,
				.45,
				0
			],
			rot: [
				0,
				0,
				Math.PI / 2 * t
			]
		}, 8)), i.add(L(.09, .09, .2, r.iron, {
			pos: [
				n + t * .12,
				.45,
				0
			],
			rot: [
				0,
				0,
				Math.PI / 2 * t
			]
		}, 6));
		for (let e of [.3, .3 + Math.PI / 2]) i.add(I(.04, .78, .06, r.woodDark, {
			pos: [
				n + t * .06,
				.45,
				0
			],
			rot: [
				e,
				0,
				0
			]
		}));
		i.add(R([
			t * .45,
			.6,
			.85
		], [
			t * .45,
			.7,
			1.9
		], .07, r.woodDark)), i.add(I(.08, .56, .08, r.woodDark, { pos: [
			t * .45,
			.56 / 2,
			.8
		] }));
	}
	if (i.add(Fe([
		-.78,
		.45,
		0
	], [
		.78,
		.45,
		0
	], .04, r.iron, 6)), i.add(Fe([
		-.5,
		.7,
		1.88
	], [
		.5,
		.7,
		1.88
	], .035, r.woodDark, 6)), M(n, "cargo", !0)) {
		let t = e.int(2, 3);
		for (let n = 0; n < t; n++) {
			let t = l(.32, 0);
			h(t, .04, e), i.add(S(g(t, F(r.straw, .08, e)), {
				pos: [
					e.range(-.25, .25),
					.9199999999999999,
					-.5 + n * .5
				],
				rot: [
					e.range(-.3, .3),
					e.range(0, 3),
					0
				],
				scale: [
					1,
					.75,
					1.1
				]
			}));
		}
	}
	return i.boxCol(0, .35, 1.6, 1, 2.6), i.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-houses.ts
function jt(e, t, n) {
	var r, i, a, o, s;
	return {
		plaster: (r = N(n, "plaster")) == null ? e.pick(t.plaster) : r,
		roof: (i = N(n, "roof")) == null ? e.pick(t.roof) : i,
		door: (a = N(n, "door")) == null ? e.pick([
			t.gate,
			(o = t.cloth[0]) == null ? t.gate : o,
			(s = t.cloth[2]) == null ? t.wood : s,
			t.woodLight
		]) : a,
		timber: F(t.wood, .04, e)
	};
}
function Mt(e, t, n) {
	let r = Math.cos(n), i = Math.sin(n);
	return [r * e + i * t, -i * e + r * t];
}
function Nt(e, t, n, r, i, a = 0) {
	e.add(h(I(r + .3, .34, i + .3, F(t.stoneDark, .03, n), {
		pos: [
			0,
			.05,
			0
		],
		rot: [
			0,
			a,
			0
		]
	}, .05), .03, n));
}
function Pt(e, t, n) {
	let r = P(t), i = jt(e, r, n), a = new H(), o = 3.5 + e.range(-.15, .25), s = 3.8 + e.range(-.15, .2), c = 2.6, l = 2.3, u = e.range(.015, .04) * e.sign();
	Nt(a, r, e, o, s);
	let d = vt(e, {
		w: o,
		d: s,
		h: c,
		plaster: i.plaster,
		timber: i.timber,
		braces: !0
	});
	bt(d, r, e, -o * .18, s, i.door), U(d, r, e, "front", o, s, o * .27, 1.45), U(d, r, e, "left", o, s, 0, 1.4), U(d, r, e, "right", o, s, .3, 1.4, { shutter: !0 }), a.absorb(d, {
		pos: [
			0,
			.22,
			0
		],
		lean: [u, 0]
	});
	let f = o + .3, p = s + .35, m = e.range(-.05, .05), h = u + Math.sign(u) * e.range(.01, .03), g = u * c, _ = vt(e, {
		w: f,
		d: p,
		h: l,
		plaster: F(i.plaster, .03, e),
		timber: i.timber,
		braces: !0
	});
	U(_, r, e, "front", f, p, -f * .24, 1.2), U(_, r, e, "front", f, p, f * .24, 1.2, { shutter: e.chance(.5) }), U(_, r, e, "left", f, p, -.4, 1.2), U(_, r, e, "right", f, p, .4, 1.2), U(_, r, e, "back", f, p, 0, 1.2, { lit: .5 }), a.absorb(_, {
		pos: [
			g,
			2.8200000000000003,
			.12
		],
		rotY: m,
		lean: [h, 0]
	});
	let v = {
		w: f,
		d: p,
		pitch: .92,
		over: .35,
		rows: 3,
		thick: .16,
		color: i.roof,
		gable: i.plaster
	}, y = xt(e, r, v), b = St(v, 0);
	U(y, r, e, "front", f, p, 0, b * .36, {
		ww: .38,
		wh: .42,
		sill: !1
	});
	let x = f / 2 - .8, S = St(v, x) - .3;
	y.absorb(Ct(e, r, b + .75 - S), {
		pos: [
			x,
			S,
			-p * .2
		],
		lean: [e.range(-.04, .04), 0]
	});
	let [C, w] = Mt(h * l, 0, m);
	return a.absorb(y, {
		pos: [
			g + C,
			5.12,
			.12 + w
		],
		rotY: m
	}), a.boxCol(g / 2, 0, o + .3, 5.12, s + .3), a.done();
}
function Ft(e, t, n) {
	let r = P(t), i = jt(e, r, n), a = new H(), o = 5.4 + e.range(-.2, .3), s = 3.6 + e.range(-.1, .2), c = 2.45, l = e.range(-.03, .03), u = e.range(.01, .035) * e.sign();
	Nt(a, r, e, o, s);
	let d = vt(e, {
		w: o,
		d: s,
		h: c,
		plaster: i.plaster,
		timber: i.timber,
		braces: !1
	});
	bt(d, r, e, -.45, s, i.door), U(d, r, e, "front", o, s, -1.75, 1.4), U(d, r, e, "front", o, s, 1.05, 1.4, { shutter: !0 }), wt(d, r, e, 1.05, .9, s / 2 + .03), U(d, r, e, "back", o, s, .8, 1.4, { lit: .6 }), U(d, r, e, "back", o, s, -1.4, 1.4, { lit: .6 }), a.absorb(d, {
		pos: [
			0,
			.22,
			0
		],
		lean: [l, u]
	});
	let f = e.chance(.5) ? {
		w: s,
		d: o,
		pitch: .78,
		over: .45,
		rows: 2,
		thick: .3,
		color: r.straw,
		gable: i.plaster,
		bevel: .08,
		roundRidge: !0
	} : {
		w: s,
		d: o,
		pitch: .66,
		over: .4,
		rows: 3,
		thick: .15,
		color: i.roof,
		gable: i.plaster
	}, p = xt(e, r, f), m = St(f, 0);
	U(p, r, e, "front", s, o, 0, m * .35, {
		ww: .34,
		wh: .36,
		sill: !1,
		lit: .7
	}), a.absorb(p, {
		pos: [
			l * c,
			2.6700000000000004,
			u * c
		],
		rotY: Math.PI / 2
	});
	let g = 2.6700000000000004 + m + .9;
	a.absorb(Ct(e, r, g, .78), {
		pos: [
			-(o / 2 + .36),
			0,
			.3
		],
		lean: [-.015, 0]
	}), a.boxCol(-(o / 2 + .36), .3, .9, g, .9);
	let _ = 1.5, v = 2.4, y = 1.7, b = o / 2 + _ / 2 + .06, x = -.3;
	a.add(h(I(_, y, v, F(r.woodLight, .04, e), { pos: [
		b,
		y / 2,
		x
	] }, .03), .02, e));
	for (let e = 0; e < 3; e++) a.add(I(.04, 1.5999999999999999, .03, r.woodDark, { pos: [
		b - _ / 2 + .38 * (e + 1),
		y / 2,
		.9099999999999999
	] }));
	return a.add(I(2, .12, 2.8, F(i.roof, .04, e), {
		pos: [
			b + .05,
			2.02,
			x
		],
		rot: [
			0,
			0,
			-.36
		]
	}, .03)), a.add(S(Tt(e, r, .85), { pos: [
		b + .2,
		0,
		1.3499999999999999
	] })), a.boxCol(b, x, _, y, v), a.cylCol(b + .2, 1.3499999999999999, .35, .8), a.boxCol(0, 0, o + .3, 2.6700000000000004, s + .3), a.done();
}
function It(e, t, n) {
	let r = P(t), i = jt(e, r, n), a = new H(), o = [
		3.3,
		3,
		2.6
	].map((t) => t + e.range(-.1, .1)), s = [
		3.2,
		2.9,
		2.5
	].map((t) => t + e.range(-.1, .1)), c = [
		2.5,
		2.2,
		1.95
	], l = e.sign(), u = e.range(-.06, .06);
	Nt(a, r, e, o[0], s[0], u);
	let f = 0, p = .22, m = 0, h = 0;
	for (let t = 0; t < 3; t++) {
		let n = o[t], d = s[t], g = c[t];
		h = t === 0 ? u : e.range(-.1, .1);
		let _ = (t % 2 == 0 ? 1 : -1) * l * e.range(.03, .06), v = e.range(-.02, .02), y = vt(e, {
			w: n,
			d,
			h: g,
			plaster: F(i.plaster, .03, e),
			timber: i.timber,
			braces: t !== 1
		});
		if (t === 0) bt(y, r, e, n * .15, d, i.door), U(y, r, e, "front", n, d, -n * .27, 1.4), U(y, r, e, "left", n, d, .2, 1.4), U(y, r, e, "right", n, d, -.2, 1.4, { shutter: !0 });
		else if (t === 1) {
			U(y, r, e, "front", n, d, -n * .22, 1.15, { shutter: !0 }), U(y, r, e, "front", n, d, n * .22, 1.15, { sill: !1 }), U(y, r, e, "right", n, d, 0, 1.15, { sill: !1 });
			let t = d / 2 + .3;
			y.add(I(1.3, .1, .55, i.timber, { pos: [
				n * .22,
				.05,
				t - .02
			] }));
			for (let e of [
				-.55,
				0,
				.55
			]) y.add(I(.06, .55, .06, r.woodLight, { pos: [
				n * .22 + e,
				.35,
				t + .2
			] }));
			y.add(I(1.3, .07, .08, r.woodLight, { pos: [
				n * .22,
				.65,
				t + .2
			] })), y.absorb(Ct(e, r, c[2] + 2.7, .55), {
				pos: [
					n / 2 + .3,
					0,
					-.35
				],
				lean: [.05 * l, 0]
			});
		} else U(y, r, e, "front", n, d, 0, 1, {
			ww: .5,
			wh: .55,
			sill: !1
		}), U(y, r, e, "left", n, d, 0, 1, {
			sill: !1,
			lit: .6
		});
		a.absorb(y, {
			pos: [
				f,
				p,
				m
			],
			rotY: h,
			lean: [_, v]
		}), t === 0 && a.boxCol(0, 0, n + .3, .22 + g, d + .3, u);
		let [b, x] = Mt(_ * g, v * g, h);
		f += b, m += x, p += g;
	}
	let _ = o[2] + .7, v = s[2] + .7, y = new H();
	y.add(I(_, .14, v, F(i.roof, .04, e), { pos: [
		0,
		.07,
		0
	] }, .03));
	let b = S(g(d(_ / 2 * Math.SQRT2, 2.5, 4), i.roof), {
		pos: [
			0,
			.12,
			0
		],
		rot: [
			0,
			Math.PI / 4,
			0
		]
	});
	return S(b, { scale: [
		1,
		1,
		v / _
	] }), y.add(Ie(b, .1 * l, .03)), y.add(R([
		.25 * l,
		2.55,
		.075
	], [
		.3 * l,
		3.05,
		.09
	], .06, r.woodDark)), y.add(V(.12, r.gold, { pos: [
		.3 * l,
		3.1,
		.09
	] })), a.absorb(y, {
		pos: [
			f,
			p,
			m
		],
		rotY: h
	}), a.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-market.ts
var Lt = "#F6EEDC";
function Rt(e, t, n, r, i, a, o) {
	let s = Math.max(2, Math.floor(i / .75));
	for (let c = 0; c < s; c++) {
		let u = -i / 2 + i * (c + .5) / s + t.range(-.08, .08), f = t.pick(n.cloth);
		if (r === "fruit") {
			e.add(L(.2, .15, .12, n.straw, { pos: [
				u,
				a,
				o
			] }, 6));
			for (let n = 0; n < 3; n++) {
				let r = t.pick([
					"#D9483B",
					"#F2A33A",
					"#9CC94A",
					"#F2D04A"
				]), i = n / 3 * Math.PI * 2 + t.range(-.3, .3);
				e.add(S(g(l(.085, 0), r), { pos: [
					u + Math.cos(i) * .08,
					a + .16,
					o + Math.sin(i) * .08
				] }));
			}
		} else if (r === "sweets") {
			e.add(L(.11, .12, .26, Lt, { pos: [
				u,
				a,
				o
			] }, 6)), e.add(L(.07, .07, .06, f, { pos: [
				u,
				a + .26,
				o
			] }, 6));
			for (let r = 0; r < 3; r++) e.add(V(.06, t.pick(n.blossom), { pos: [
				u + t.range(-.25, .25),
				a + .05,
				o + .2
			] }));
		} else r === "hats" ? (e.add(L(.2, .2, .03, f, { pos: [
			u,
			a,
			o
		] }, 8)), e.add(S(g(d(.12, .26, 6), F(f, .08, t)), {
			pos: [
				u,
				a + .03,
				o
			],
			rot: [
				t.range(-.2, .2),
				0,
				t.range(-.2, .2)
			]
		}))) : (e.add(I(.22, .14, .18, f, {
			pos: [
				u,
				a + .07,
				o
			],
			rot: [
				0,
				t.range(-.4, .4),
				0
			]
		}, .02)), e.add(V(.07, n.gold, { pos: [
			u + .18,
			a + .07,
			o + .12
		] })));
	}
}
function zt(e, t, n) {
	var r, i, a;
	let o = P(t), s = new H(), c = j(n, "width", 2.6, 1.4, 5), l = j(n, "depth", 1.5, 1, 3), u = (r = (i = N(n, "colorA")) == null ? N(n, "color") : i) == null ? e.pick(o.cloth) : r, d = (a = N(n, "colorB")) == null ? Lt : a, f = l / 2 - .3;
	s.add(I(c, .95, .6, F(o.wood, .04, e), { pos: [
		0,
		.475,
		f
	] }, .03)), s.add(I(c + .12, .08, .72, F(o.woodLight, .04, e), { pos: [
		0,
		.99,
		f
	] }, .02));
	let p = Math.max(3, Math.round(c / .42)), m = c / p;
	for (let e = 0; e < p; e++) s.add(I(m, .72, .02, e % 2 == 0 ? u : d, { pos: [
		-c / 2 + m * (e + .5),
		.5,
		f + .31
	] }));
	let h = 2.45;
	for (let t of [-1, 1]) s.add(I(.1, 2, .1, o.woodDark, {
		pos: [
			t * (c / 2 - .05),
			1,
			l / 2 - .05
		],
		rot: [
			0,
			0,
			e.range(-.02, .02)
		]
	})), s.add(I(.1, h, .1, o.woodDark, { pos: [
		t * (c / 2 - .05),
		h / 2,
		-l / 2 + .05
	] }));
	let g = .45, _ = l + g, v = .5500000000000002, y = Math.hypot(_, v), b = Math.atan2(v, _), x = (-l / 2 + l / 2 + g) / 2;
	for (let t = 0; t < p; t++) {
		let n = -c / 2 + m * (t + .5);
		s.add(I(m + .01, .04, y, t % 2 == 0 ? u : d, {
			pos: [
				n,
				2.265,
				x
			],
			rot: [
				b,
				0,
				0
			]
		}));
		let r = [
			[-m / 2, 0],
			[m / 2, 0],
			[m * .32, -.24],
			[-m * .32, -.24]
		];
		s.add(z(r, .03, t % 2 == 0 ? d : u, {
			pos: [
				n,
				1.96,
				l / 2 + g
			],
			rot: [
				e.range(-.06, .06),
				0,
				0
			]
		}));
	}
	return Rt(s, e, o, Ee(n, "goods", e.pick([
		"fruit",
		"sweets",
		"hats",
		"trinkets"
	])), c - .3, 1.03, f), s.boxCol(0, 0, c + .12, 1.05, l), s.done();
}
function Bt(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "width", 2, 1.2, 4), o = j(n, "height", 2.4, 1.5, 4), s = M(n, "open", !1), c = r.iron, l = a / 2;
	i.add(I(a + .3, .2, a + .3, F(r.stoneDark, .03, e), { pos: [
		0,
		.08,
		0
	] }, .04)), i.add(I(a, .06, a, c, { pos: [
		0,
		.21,
		0
	] })), i.add(I(a + .12, .1, a + .12, c, { pos: [
		0,
		o,
		0
	] })), i.add(S(g(d(l * 1.15, .6, 4), F(c, .04, e)), {
		pos: [
			0,
			o + .05,
			0
		],
		rot: [
			0,
			Math.PI / 4,
			0
		]
	})), i.add(V(.1, r.brass, { pos: [
		0,
		o + .7,
		0
	] }));
	for (let e of [-1, 1]) for (let t of [-1, 1]) i.add(I(.1, o - .2, .1, c, { pos: [
		e * l,
		o / 2 + .1,
		t * l
	] }));
	let u = Math.max(3, Math.round(a / .3) - 1), f = .8, p = o - .24;
	for (let t = 0; t < 4; t++) {
		let n = t * Math.PI / 2, r = new H();
		for (let n = 1; n <= u; n++) {
			let i = -l + a * n / (u + 1);
			t === 0 && Math.abs(i) < f / 2 || r.add(I(.05, p, .05, c, {
				pos: [
					i,
					.24 + p / 2,
					l
				],
				rot: [
					0,
					0,
					e.range(-.012, .012)
				]
			}));
		}
		r.add(I(a, .07, .07, c, { pos: [
			0,
			o * .55,
			l
		] })), i.absorb(r, { rotY: n });
	}
	let m = new H();
	m.add(I(.07, p, .07, c, { pos: [
		.035,
		p / 2,
		0
	] }), I(.07, p, .07, c, { pos: [
		.765,
		p / 2,
		0
	] })), m.add(I(f, .07, .07, c, { pos: [
		f / 2,
		.1,
		0
	] }), I(f, .07, .07, c, { pos: [
		f / 2,
		p - .1,
		0
	] }));
	for (let e of [.33, .66]) m.add(I(.05, p, .05, c, { pos: [
		f * e,
		p / 2,
		0
	] }));
	m.add(I(.16, .2, .08, r.brass, { pos: [
		.7200000000000001,
		p * .5,
		.05
	] }));
	let h = s ? -(Math.PI / 2 + .2) : 0;
	i.absorb(m, {
		pos: [
			-.8 / 2,
			.24,
			l
		],
		rotY: h
	}), i.boxCol(0, -l, a + .1, o, .14), i.boxCol(-l, 0, .14, o, a + .1), i.boxCol(l, 0, .14, o, a + .1);
	let _ = l - f / 2;
	return i.boxCol(-(l - _ / 2), l, _, o, .14), i.boxCol(l - _ / 2, l, _, o, .14), s || i.boxCol(0, l, f, o, .14), i.done();
}
function Vt(e, t, n) {
	var r, i;
	let a = P(t), o = new H(), s = j(n, "height", 3.6, 1.5, 10), c = (r = N(n, "color")) == null ? e.pick(a.cloth) : r, l = (i = N(n, "colorB")) == null ? Lt : i;
	o.add(I(.42, .3, .42, F(a.stone, .04, e), { pos: [
		0,
		.12,
		0
	] }, .04)), o.add(L(.045, .065, s, a.woodDark, { pos: [
		0,
		0,
		0
	] }, 6)), o.add(V(.09, a.gold, { pos: [
		0,
		s + .05,
		0
	] }));
	let u = s - .1, d = e.range(.2, .4), f = d - e.range(.4, .7), p = s / 3.6, m = [
		[0, 0],
		[.75 * p, -.04 * p],
		[.75 * p, -.6 * p],
		[0, -.66 * p]
	];
	o.add(z(m, .03, c, {
		pos: [
			0,
			u,
			0
		],
		rot: [
			0,
			d,
			0
		]
	})), o.add(z([
		[0, -.26 * p],
		[.75 * p, -.27 * p],
		[.75 * p, -.37 * p],
		[0, -.4 * p]
	], .04, l, {
		pos: [
			0,
			u,
			0
		],
		rot: [
			0,
			d,
			0
		]
	}));
	let h = Math.cos(d) * .75 * p, g = -Math.sin(d) * .75 * p, _ = [
		[0, -.04 * p],
		[.6 * p, 0],
		[.38 * p, -.3 * p],
		[.6 * p, -.62 * p],
		[0, -.6 * p]
	];
	return o.add(z(_, .03, F(c, .05, e), {
		pos: [
			h,
			u,
			g
		],
		rot: [
			0,
			f,
			0
		]
	})), o.cylCol(0, 0, .24, s), o.done();
}
function Ht(e, t, n) {
	let r = P(t), i = new H(), a = Math.round(j(n, "arrows", e.int(1, 2), 0, 3)), o = a === 0 ? 1.7 : 2.1, s = e.range(-.04, .04), c = new H();
	if (c.add(I(.13, o, .13, F(r.wood, .04, e), { pos: [
		0,
		o / 2,
		0
	] }, .02)), c.add(S(g(d(.11, .14, 4), r.woodDark), {
		pos: [
			0,
			o,
			0
		],
		rot: [
			0,
			Math.PI / 4,
			0
		]
	})), a === 0) {
		c.add(I(1, .66, .07, F(r.woodLight, .04, e), { pos: [
			0,
			o - .4,
			.1
		] }, .02));
		for (let e = 0; e < 3; e++) c.add(I(.6 - e * .12, .035, .02, r.woodDark, { pos: [
			-.05 * e,
			o - .25 - e * .13,
			.145
		] }));
		for (let e of [-1, 1]) c.add(I(.62, .06, .32, r.woodDark, {
			pos: [
				e * .27,
				o + .08,
				.1
			],
			rot: [
				0,
				0,
				-e * .45
			]
		}, .015));
	} else {
		let t = [
			[-.45, -.13],
			[.3, -.13],
			[.47, 0],
			[.3, .13],
			[-.45, .13]
		];
		for (let n = 0; n < a; n++) {
			let i = n % 2 == 0 ? 1 : -1, a = o - .32 - n * .34, s = (i === 1 ? 0 : Math.PI) + e.range(-.25, .25), l = new H();
			l.add(z(t, .06, F(r.woodLight, .05, e), { rot: [
				0,
				0,
				e.range(-.05, .05)
			] })), l.add(I(.42, .03, .02, r.woodDark, { pos: [
				-.1,
				.03,
				.04
			] }), I(.3, .03, .02, r.woodDark, { pos: [
				-.16,
				-.04,
				.04
			] })), c.absorb(l, {
				pos: [
					Math.cos(s) * .3,
					a,
					-Math.sin(s) * .3 + .08
				],
				rotY: s
			});
		}
	}
	return i.absorb(c, { lean: [s, 0] }), i.cylCol(0, 0, .15, o), i.done();
}
function Ut(e, t, n, r, i, a = !0) {
	e.add(I(.28, .04, .28, t.iron, { pos: [
		n,
		r,
		i
	] }));
	for (let a of [-1, 1]) for (let o of [-1, 1]) e.add(I(.03, .32, .03, t.iron, { pos: [
		n + a * .12,
		r + .17,
		i + o * .12
	] }));
	e.add(S(g(d(.22, .18, 4), t.iron), {
		pos: [
			n,
			r + .32,
			i
		],
		rot: [
			0,
			Math.PI / 4,
			0
		]
	})), e.add(V(.05, t.iron, { pos: [
		n,
		r + .53,
		i
	] }));
	let o = I(.2, .28, .2, a ? t.windowGlow : t.iron, { pos: [
		n,
		r + .17,
		i
	] });
	a ? e.glow(o) : e.add(o);
}
function Wt(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "height", 2.6, 1.2, 5), o = Ee(n, "style", "post") === "hang", s = M(n, "lit", !0);
	if (i.add(I(.4, .26, .4, F(r.stone, .04, e), { pos: [
		0,
		.1,
		0
	] }, .04)), i.add(L(.06, .085, a, r.iron, {
		pos: [
			0,
			.2,
			0
		],
		rot: [
			e.range(-.02, .02),
			0,
			e.range(-.02, .02)
		]
	}, 6)), i.add(L(.1, .1, .1, r.iron, { pos: [
		0,
		.5,
		0
	] }, 6)), o) {
		let e = [
			0,
			a + .2,
			0
		];
		i.add(R(e, [
			.32,
			a + .32,
			0
		], .05, r.iron), R([
			.32,
			a + .32,
			0
		], [
			.6,
			a + .22,
			0
		], .05, r.iron)), i.add(I(.02, .2, .02, r.iron, { pos: [
			.6,
			a + .1,
			0
		] })), Ut(i, r, .6, a - .48, 0, s);
	} else Ut(i, r, 0, a + .2, 0, s);
	return i.cylCol(0, 0, .2, a + .6), i.done();
}
function Gt(e, t, n) {
	let r = P(t), i = new H(), a = Math.round(j(n, "count", 1, 1, 5)), o = j(n, "height", .25, .08, 1), s = M(n, "stand", !1), c = 0;
	if (s) {
		for (let e = 0; e < 3; e++) {
			let t = e * Math.PI * 2 / 3 + .3;
			i.add(R([
				0,
				.18,
				0
			], [
				Math.cos(t) * .24,
				0,
				Math.sin(t) * .24
			], .04, r.iron));
		}
		i.add(L(.025, .03, 1.1, r.iron, { pos: [
			0,
			.1,
			0
		] }, 6)), c = 1.18, i.cylCol(0, 0, .24, c + o);
	}
	i.add(L(a > 1 ? .2 : .11, a > 1 ? .22 : .13, .03, r.brass, { pos: [
		0,
		c,
		0
	] }, 8));
	for (let t = 0; t < a; t++) {
		let n = t * Math.PI * 2 / Math.max(1, a - 1), s = t === 0 || a === 1 ? 0 : .12, l = Math.cos(n) * s, u = Math.sin(n) * s, d = o * (t === 0 ? 1 : e.range(.55, .85)), f = .03 + o * .06;
		i.add(L(f * .95, f, d, F(r.wax, .03, e), { pos: [
			l,
			c + .03,
			u
		] }, 6)), i.add(V(f * .38, r.wax, {
			pos: [
				l + f * .85,
				c + .03 + d - f * .3,
				u
			],
			scale: [
				.8,
				1.2,
				.8
			]
		}));
		let p = c + .03 + d;
		i.add(I(.01, .03, .01, r.hollow, { pos: [
			l,
			p + .012,
			u
		] })), Re(i, r, l, p + .02, u, f * .55);
	}
	return i.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built-sacred.ts
function Kt(e, t, n, r, i, a) {
	return S(g(h(l(a, 0), a * .18, e), t), {
		pos: [
			n,
			r,
			i
		],
		rot: [
			e.range(0, 3),
			e.range(0, 3),
			0
		],
		scale: [
			1,
			.7,
			1
		]
	});
}
function qt(e, t, n, r, i, a = 1) {
	for (let o = 0; o < 2; o++) e.add(S(g(d(.06 * a, .26 * a, 4), F(n.leaf, .05, t)), {
		pos: [
			r + t.range(-.05, .05),
			-.02,
			i + t.range(-.05, .05)
		],
		rot: [
			t.range(-.3, .3),
			t.range(0, 3),
			t.range(-.3, .3)
		]
	}));
}
function Jt(e, t, n) {
	let r = P(t), i = new H(), a = A(r.stoneLight, r.path, .25), o = [
		[-.42, 0],
		[.42, 0],
		[.38, .75],
		[.32, 1.05],
		[.18, 1.27],
		[0, 1.36],
		[-.18, 1.27],
		[-.32, 1.05],
		[-.38, .75]
	], s = e.range(-.035, .035), c = new H();
	c.add(h(z(o, .4, a, {}, .05), .025, e));
	let l = .26, u = .92;
	c.add(z([...B(0, 0, .17, .17, 0, Math.PI, 6)], .04, r.gold, { pos: [
		0,
		u,
		l
	] }));
	for (let e = 0; e < 5; e++) {
		let t = Math.PI * (e + 1) / 6;
		c.add(I(.035, .09, .03, r.gold, {
			pos: [
				Math.cos(t) * .25,
				u + Math.sin(t) * .25,
				l
			],
			rot: [
				0,
				0,
				t - Math.PI / 2
			]
		}));
	}
	c.add(I(.52, .025, .03, r.stoneLight, { pos: [
		0,
		.91,
		l
	] })), c.add(z([
		[-.16, .36],
		[.16, .36],
		[.025, .89],
		[-.025, .89]
	], .03, A(r.path, "#FFFFFF", .2), { pos: [
		0,
		0,
		l
	] })), c.add(I(.36, .12, .04, r.stoneDark, { pos: [
		0,
		.2,
		.255
	] })), c.glow(I(.27, .05, .03, r.windowGlow, { pos: [
		0,
		.2,
		.272
	] })), i.absorb(c, {
		pos: [
			0,
			.08,
			0
		],
		lean: [s, 0]
	}), i.add(h(I(1, .16, .62, F(r.stoneDark, .03, e), { pos: [
		0,
		.05,
		0
	] }, .04), .02, e));
	for (let t = 0; t < 3; t++) {
		let t = e.range(0, Math.PI * 2);
		i.add(Kt(e, F(r.stone, .06, e), Math.cos(t) * .62, .05, Math.sin(t) * .45, e.range(.1, .16)));
	}
	return qt(i, e, r, -.5, .25), qt(i, e, r, .45, -.3), i.cylCol(0, 0, .5, 1.45), i.done();
}
function Yt(e, t, n) {
	let r = P(t), i = new H(), a = 2.6, o = 1.5, s = 1.9, c = .75;
	for (let t of [-1, 1]) for (let n of [-1, 1]) i.add(L(.07, .085, s, F(r.wood, .05, e), {
		pos: [
			a / 2 * t,
			0,
			o / 2 * n
		],
		rot: [
			0,
			0,
			t * -.03
		]
	}, 5)), i.cylCol(a / 2 * t, o / 2 * n, .11, 2.65);
	let u = ze([
		r.leaf,
		r.leafDark,
		F(r.leaf, .06, e)
	]), d = B(0, 1.7999999999999998, 1.32, .8, 0, Math.PI, 5);
	for (let t of [-1, 1]) for (let n = 0; n + 1 < d.length; n++) {
		let a = d[n], s = d[n + 1], c = .12, l = (s[0] - a[0]) * c, u = (s[1] - a[1]) * c, f = R([
			a[0] - l,
			a[1] - u,
			o / 2 * t
		], [
			s[0] + l,
			s[1] + u,
			o / 2 * t
		], .36, F(r.leaf, .06, e), .44);
		i.add(h(f, .035, e));
	}
	let f = [];
	for (let t of [-1, 1]) for (let n of [.3, .7]) {
		let r = Math.PI * n + e.range(-.08, .08);
		f.push([
			a / 2 * Math.cos(r),
			s + Math.sin(r) * c + .12,
			t * .8,
			e.range(.24, .3)
		]);
	}
	for (let t of [
		.3,
		.5,
		.7
	]) {
		let n = Math.PI * t;
		f.push([
			a / 2 * Math.cos(n) * .92,
			s + Math.sin(n) * c + .1,
			e.range(-.12, .12),
			e.range(.32, .38)
		]);
	}
	f.push([
		-2.6 / 2,
		1.2,
		o / 2,
		.2
	], [
		a / 2,
		.9,
		-1.5 / 2,
		.2
	]);
	for (let [t, n, r, a] of f) {
		let o = h(l(a, 0), a * .15, e);
		i.add(S(g(o, u), {
			pos: [
				t,
				n,
				r
			],
			rot: [
				e.range(0, 3),
				e.range(0, 3),
				0
			],
			scale: [
				1.25,
				.8,
				1.25
			]
		}));
	}
	for (let t = 0; t < 6; t++) {
		let [t, n, a, o] = f[e.int(0, f.length - 1)], s = e.range(0, Math.PI * 2);
		i.add(V(.07, e.pick(r.blossom), { pos: [
			t + Math.cos(s) * o * .9,
			n + e.range(-.1, .25),
			a + Math.sin(s) * o * .9
		] }));
	}
	let p = -.15;
	i.add(I(2.1, .08, .44, F(r.woodLight, .04, e), { pos: [
		0,
		.46,
		p
	] }, .02));
	for (let e of [-1, 1]) i.add(I(.08, .42, .38, r.wood, { pos: [
		e * (a / 2 - .45),
		.21,
		p
	] }));
	i.add(I(2.1, .2, .05, F(r.woodLight, .04, e), {
		pos: [
			0,
			.85,
			-.39
		],
		rot: [
			-.12,
			0,
			0
		]
	}));
	for (let e of [-1, 1]) i.add(I(.06, .5, .05, r.wood, {
		pos: [
			e * (a / 2 - .5),
			.68,
			-.37
		],
		rot: [
			-.12,
			0,
			0
		]
	}));
	return i.boxCol(0, p, 2.1, .5, .48), i.done();
}
function Xt(e, t, n) {
	let r = P(t), i = new H(), a = j(n, "height", 4.2, 2, 8), o = M(n, "mound", !0), s = o ? .46 : 0;
	if (o) {
		let t = ze([
			r.grass,
			F(r.grass, .05, e),
			A(r.grass, r.leaf, .5)
		]), n = S(Le(9), {
			pos: [
				0,
				-.12,
				0
			],
			scale: [
				2.3,
				.6,
				2
			]
		});
		i.add(g(h(n, .06, e), (e, n) => n.y > .2 ? t(e) : r.earth));
	}
	let c = r.cross;
	i.add(I(.3, a, .3, c, { pos: [
		0,
		s - .25 + a / 2,
		0
	] }, .03)), i.add(I(2, .28, .28, F(c, .03, e), { pos: [
		0,
		s + a - 1.15,
		.01
	] }, .03));
	for (let t = 0; t < 4; t++) {
		let n = Math.PI / 2 * t + e.range(-.4, .4);
		i.add(Kt(e, F(r.stone, .05, e), Math.cos(n) * .32, s, Math.sin(n) * .32, e.range(.1, .15)));
	}
	return i.cylCol(0, 0, .28, a + s), i.boxCol(0, .01, 2, .28, .28, 0, s + a - 1.15 - .14), i.done();
}
function Zt(e, t, n) {
	let r = P(t), i = new H(), a = -1.3, o = S(Le(9), {
		pos: [
			0,
			0,
			a
		],
		scale: [
			3,
			1.75,
			2
		]
	});
	i.add(g(h(o, .08, e), Be(r.grass, r.earth, .45)));
	let s = [
		[-1.5, 0],
		[-1.62, 1],
		[-1.3, 1.6],
		[-.6, 1.92],
		[.5, 1.96],
		[1.25, 1.66],
		[1.56, 1.05],
		[1.5, 0],
		[.62, 0],
		...B(0, .95, .62, .55, 0, Math.PI, 5),
		[-.62, 0]
	], c = ze([
		r.tomb,
		r.stoneLight,
		F(r.tomb, .05, e)
	]);
	i.add(h(z(s, .7, (e, t) => Math.abs(t.z) > .5 ? r.tomb : c(e), { pos: [
		0,
		0,
		.55
	] }), .03, e)), i.add(I(1.3, 1.52, .5, r.hollow, { pos: [
		0,
		.76,
		.45
	] })), i.add(I(1.55, .08, .55, r.stoneLight, { pos: [
		0,
		.03,
		1.05
	] }, .02)), i.add(h(Fe([
		2.05,
		.85,
		.8
	], [
		2.11,
		.85,
		1.14
	], .85, F(r.tomb, .04, e), 10), .03, e)), i.boxCol(2.0799999999999996, .97, 1.7, 1.7, .34);
	for (let t = 0; t < 4; t++) {
		let t = e.range(-1.6, 1.6), n = e.range(-2, -.9), o = 1.75 * Math.sqrt(Math.max(0, 1 - (t / 3) ** 2 - ((n - a) / 2) ** 2));
		i.add(V(.07, e.pick(r.blossom), { pos: [
			t,
			o + .02,
			n
		] }));
	}
	return qt(i, e, r, -1.6, .9), qt(i, e, r, 1, 1, .8), i.boxCol(0, a, 4.8, 1.6, 3), i.boxCol(0, .55, 3.2, 1.95, .7), i.done();
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/built.ts
var Qt = {
	fence: Xe,
	wall: Ye,
	stile: Ze,
	bridge_plank: Qe,
	gate: rt,
	wicket_gate: it,
	house_a: Pt,
	house_b: Ft,
	house_c: It,
	waystone: Jt,
	arbour: Yt,
	cross: Xt,
	tomb: Zt,
	stall: zt,
	cage: Bt,
	flag: Vt,
	sign: Ht,
	lamp: Wt,
	candle: Gt,
	well: Et,
	bench: Dt,
	barrel: Ot,
	crate: kt,
	cart: At,
	palace_tower: ot,
	castle_tower: st,
	mountain_peak: lt,
	book: He,
	far_light: Ue,
	boot: We,
	cover_rock: Ge,
	arrow: Ke,
	town_wall: dt,
	town_gate: ft,
	village_door: ht,
	mountain_overhang: pt,
	castle_ridge: gt
}, W = Math.PI * 2, G = .1, $t = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
function en(e, t) {
	let n = e[t];
	if (typeof n == "number") return Number.isFinite(n) ? n : null;
	if (typeof n == "string" && n.trim() !== "") {
		let e = Number(n);
		return Number.isFinite(e) ? e : null;
	}
	return null;
}
function K(e, t, n) {
	var r;
	let i = en(t, "variant"), a = i === null ? e.int(0, 3) : Math.min(3, Math.max(0, Math.floor(i))), [o, s] = typeof n == "function" ? n(a) : n, c = en(t, "height"), l = c !== null && c > 0 ? c : e.range(o, s), u = (r = t.colour) == null ? t.color : r;
	return {
		variant: a,
		height: l,
		colour: typeof u == "string" && $t.test(u) ? u : null,
		lod: +(en(t, "lod") === 1 || t.lod === !0)
	};
}
var tn = new e.Color(), nn = {
	h: 0,
	s: 0,
	l: 0
}, rn = (e) => Math.min(1, Math.max(0, e));
function q(t, n, r, i) {
	return tn.set(t).getHSL(nn, e.SRGBColorSpace), tn.setHSL((nn.h + n + 1) % 1, rn(nn.s + r), rn(nn.l + i), e.SRGBColorSpace), `#${tn.getHexString(e.SRGBColorSpace)}`;
}
function J(e, t = .06) {
	return [
		q(e, 0, 0, -t),
		e,
		q(e, 0, 0, t)
	];
}
function Y(e, t, n = .035) {
	return we(e, n, t.next());
}
function X(e, t, n = {}) {
	var r;
	let i = (r = n.top) == null ? .2 : r, a = n.under;
	return (n, r) => {
		if (a !== void 0 && r.y < -.55) return a;
		let o = t.next() + r.y * i;
		return o < .2 ? e[0] : o > .88 ? e[2] : e[1];
	};
}
var Z = {
	red: "#E0553F",
	orange: "#F08A3C",
	gold: "#F2BE45",
	pink: "#F2A3BC",
	lilac: "#B7A2E6",
	cream: "#F7F1E1",
	grape: "#6E4A8E",
	capRed: "#C9563E"
}, an = [
	"flowersPink",
	"flowersBlue",
	"flowersYellow",
	"pink",
	"violet",
	"mustard",
	"teal",
	"sheep",
	"haze",
	"dawnA",
	"keyGold"
], on = [
	"warmRed",
	"fire",
	"embers",
	"dusk"
], sn = /* @__PURE__ */ new WeakMap();
function cn(e, t) {
	let n = [];
	for (let r of t) {
		let t = e.accents[r];
		t !== void 0 && !n.includes(t) && n.push(t);
	}
	return n;
}
function Q(e) {
	var t, n, r, i, a, o, s, c, l, u, d, f, p, m, h;
	let g = sn.get(e);
	if (g) return g;
	let _ = e.ground, v = e.accents, y = (t) => A(t, e.light.sun, .1), b = (t = (n = v.timber) == null ? v.wood : n) == null ? q(_.slope, -.02, .12, -.14) : t, x = cn(e, an);
	for (let e of [
		Z.pink,
		Z.gold,
		Z.cream,
		Z.lilac
	]) x.length < 3 && x.push(y(e));
	let S = cn(e, on);
	for (let e of [Z.red, Z.orange]) S.length < 2 && S.push(y(e));
	let C = {
		leaf: q(_.mid, .01, .08, -.08),
		leafLight: q(_.high, 0, .06, -.03),
		pine: q(_.mid, .05, -.02, -.17),
		fruitLeaf: q(_.low, -.01, .08, -.05),
		grass: q(_.low, .01, .1, -.02),
		grassTip: q(_.low, .02, .12, .07),
		reed: (r = v.reeds) == null ? q(_.mid, -.02, 0, .02) : r,
		cattail: q(b, 0, .05, -.03),
		bark: b,
		barkDead: q(b, 0, -.12, .12),
		woodCut: q(_.path, 0, 0, -.03),
		stone: (i = (a = v.stone) == null ? v.tomb : a) == null ? q(A(_.slope, _.pathEdge, .5), 0, -.06, .02) : i,
		moss: q(_.mid, .02, .06, -.04),
		lilyPad: q(_.low, .03, .05, -.1),
		lilyFlower: (o = (s = v.flowersPink) == null ? v.pink : s) == null ? y(A(Z.pink, Z.cream, .4)) : o,
		petals: x,
		centre: (c = (l = (u = (d = v.flowersYellow) == null ? v.mustard : d) == null ? v.keyGold : u) == null ? v.cityGold : l) == null ? y(Z.gold) : c,
		fruit: S,
		grape: (f = (p = v.violet) == null ? v.plum : p) == null ? y(Z.grape) : f,
		caps: [
			(m = (h = v.warmRed) == null ? v.embers : h) == null ? y(Z.capRed) : m,
			q(b, 0, .04, .14),
			y(Z.cream)
		],
		stem: q(_.path, 0, -.1, .05),
		wire: q(_.slope, 0, -.1, -.15)
	};
	return sn.set(e, C), C;
}
function $(e, t, n, r, i) {
	return S(e, {
		pos: t,
		rot: [
			0,
			Math.PI - n,
			r
		],
		scale: i == null ? 1 : i
	});
}
function ln(e, t, n, r) {
	let i = Math.sin(n) * r;
	return [
		e[0] + Math.cos(t) * i,
		e[1] + Math.cos(n) * r,
		e[2] + Math.sin(t) * i
	];
}
function un(e, t) {
	let n = e.getAttribute("position");
	for (let e = 0; e < n.count; e++) n.getY(e) < t && n.setY(e, t);
	return n.needsUpdate = !0, e.computeVertexNormals(), e.computeBoundingBox(), e.computeBoundingSphere(), e;
}
function dn(e, t, n = 0, r = 0, i = 0) {
	return {
		kind: "cylinder",
		center: [
			n,
			i + t / 2,
			r
		],
		radius: e,
		height: t
	};
}
function fn(e, t) {
	return {
		kind: "sphere",
		center: e,
		radius: t
	};
}
function pn(e, t, n = 0) {
	return {
		kind: "box",
		center: e,
		half: t,
		rotY: n
	};
}
function mn(e, t, n) {
	if (!(Math.abs(n - 1) < 1e-6)) {
		S(e, { scale: n }), e.computeBoundingBox(), e.computeBoundingSphere();
		for (let e of t) e.center = [
			e.center[0] * n,
			e.center[1] * n,
			e.center[2] * n
		], e.kind === "box" ? e.half = [
			e.half[0] * n,
			e.half[1] * n,
			e.half[2] * n
		] : e.kind === "cylinder" ? (e.radius *= n, e.height *= n) : e.radius *= n;
	}
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/nature-ground.ts
function hn(e, t) {
	let n = t.range(0, W), r = (e, r, i) => ({
		r: e,
		x: Math.cos(n + i) * r,
		z: Math.sin(n + i) * r,
		scale: [
			1,
			t.range(.7, .85),
			1
		],
		dodeca: !1
	});
	switch (e) {
		case 0: return [{
			r: 1,
			x: 0,
			z: 0,
			scale: [
				1.12,
				.72,
				.95
			],
			dodeca: !0
		}];
		case 1: return [{
			r: 1,
			x: 0,
			z: 0,
			scale: [
				1.05,
				.8,
				1
			],
			dodeca: !1
		}, r(.52, 1.18, 0)];
		case 2: return [
			{
				r: 1,
				x: 0,
				z: 0,
				scale: [
					1.05,
					.82,
					.95
				],
				dodeca: !0
			},
			r(.5, 1.12, t.range(-.3, .3)),
			r(.36, 1.05, 2.2 + t.range(-.3, .3))
		];
		default: return [{
			r: 1,
			x: 0,
			z: 0,
			scale: [
				.62,
				1.6,
				.5
			],
			dodeca: !0
		}];
	}
}
function gn(t, n, r) {
	var i;
	let a = K(t, r, (e) => [
		[.6, 1.1],
		[.5, .9],
		[.7, 1.2],
		[1.3, 1.9]
	][e]), o = t.fork("jitter"), s = t.fork("paint"), u = Q(n), d = J(Y((i = a.colour) == null ? u.stone : i, t), .06), f = q(d[0], 0, 0, -.06), p = t.chance(.35) ? Y(u.moss, t) : null, m = X(d, s, {
		top: .15,
		under: f
	}), _ = (e, t) => p && t.y > .78 ? p : m(e, t), v = [], y = [];
	for (let n of hn(a.variant, t)) {
		let r = n.dodeca ? c(new e.DodecahedronGeometry(n.r, 0)) : l(n.r, 0);
		S(r, { rot: [
			t.range(0, W),
			t.range(0, W),
			t.range(0, W)
		] });
		let i = n.r * n.scale[1] * .5, a = S(r, {
			pos: [
				n.x,
				i,
				n.z
			],
			scale: n.scale
		});
		h(a, n.r * .12, o), un(a, -.06 * n.r), v.push(g(a, _));
		let s = i + n.r * n.scale[1], u = n.r * Math.max(n.scale[0], n.scale[2]) * .85;
		n.r < .45 || y.push(n.dodeca ? dn(u, s, n.x, n.z) : fn([
			n.x,
			i,
			n.z
		], n.r * .9));
	}
	let b = w(v);
	b.computeBoundingBox(), mn(b, y, a.height / Math.max(.01, b.boundingBox.max.y));
	for (let e of y) e.kind !== "cylinder" || e.height <= a.height || (e.height = a.height, e.center = [
		e.center[0],
		a.height / 2,
		e.center[2]
	]);
	return {
		geometry: b,
		colliders: y
	};
}
function _n(e, t, n, r, i, a) {
	let o = t * .16, s = t * .62, c = S(f(o * .8, o, s + G, 5), { pos: [
		e[0],
		e[1] - G,
		e[2]
	] }), l = t * .42, u = S(f(l * .42, l, t * .42, 7), {
		pos: [
			e[0],
			e[1] + s * .92,
			e[2]
		],
		rot: [
			a.range(-.12, .12),
			a.range(0, W),
			a.range(-.12, .12)
		]
	}), d = J(n, .05), p = q(i.stem, 0, 0, .05), m = i.caps[2];
	return [g(c, i.stem), g(u, (e, t) => {
		if (t.y < -.5) return p;
		if (r && t.y > -.2 && a.chance(.3)) return m;
		let n = a.next();
		return n < .2 ? d[0] : n > .85 ? d[2] : d[1];
	})];
}
function vn(e, t, n) {
	var r;
	let i = K(e, n, (e) => e === 3 ? [.35, .5] : [.18, .32]), a = Q(t), o = i.height, s = a.caps[0], c = (r = i.colour) == null ? i.variant === 3 ? s : e.pick(a.caps) : r, l = i.variant === 3 || c === s && e.chance(.6), u = Y(c, e), d = [
		1,
		2,
		3,
		1
	][i.variant], f = [], p = e.range(0, W);
	for (let t = 0; t < d; t++) {
		let n = p + t * W / Math.max(d, 2), r = t === 0 ? 0 : o * e.range(.4, .55), i = o * (t === 0 ? 1 : e.range(.55, .8));
		f.push(..._n([
			Math.cos(n) * r,
			0,
			Math.sin(n) * r
		], i, u, l, a, e));
	}
	let m = o >= .8 ? [dn(o * .2, o)] : [];
	return {
		geometry: w(f),
		colliders: m
	};
}
function yn(e, t, n) {
	var r, i;
	let a = K(e, n, [.38, .56]), o = e.fork("jitter"), s = e.fork("paint"), c = Q(t), u = a.height / 2, p = Math.max(u * 3, (r = en(n, "length")) == null ? u * e.range(5.5, 7.5) : r), m = J(Y((i = a.colour) == null ? c.bark : i, e), .06), _ = Y(c.woodCut, e), v = u * .9, y = S(f(u * .92, u, p, 7), { rot: [
		0,
		e.range(0, W),
		0
	] });
	S(y, {
		rot: [
			0,
			0,
			Math.PI / 2
		],
		pos: [
			p / 2,
			v,
			0
		]
	}), h(y, u * .06, o);
	let b = X(m, s, { top: .15 }), x = [g(y, (e, t) => Math.abs(t.x) > .85 ? _ : b(e, t))], C = p * e.range(-.25, .25), T = v + u * .85;
	if (a.variant === 0 || a.variant === 3) {
		let t = $(d(u * .35, u * 1.5, 4), [
			C,
			T - u * .2,
			0
		], e.range(0, W), e.range(.4, .8));
		x.push(g(t, X(m, s, { top: 0 })));
	}
	if (a.variant === 1 || a.variant === 3) {
		let t = C + e.sign() * p * .2, n = S(l(u * .7, 0), {
			pos: [
				t,
				T,
				0
			],
			scale: [
				1.4,
				.35,
				1
			]
		});
		x.push(g(n, X(J(Y(c.moss, e), .05), s)));
	}
	if (a.variant === 2) for (let t = 0; t < 2; t++) {
		let n = C + (t - .5) * u * .9;
		x.push(..._n([
			n,
			T - u * .1,
			e.range(-.3, .3) * u
		], u * e.range(.6, .8), c.caps[1], !1, c, e));
	}
	return {
		geometry: w(x),
		colliders: [pn([
			0,
			v,
			0
		], [
			p / 2,
			u,
			u
		])]
	};
}
function bn(e, t, n) {
	var r;
	let i = K(e, n, [.35, .6]), a = e.fork("jitter"), o = e.fork("paint"), s = Q(t), c = i.height, l = Math.max(.2, c * e.range(.62, .8)), u = J(Y((r = i.colour) == null ? s.bark : r, e), .06), p = Y(s.woodCut, e), m = X(u, o, { top: 0 }), _ = S(f(l * .86, l, c + G, 7), {
		pos: [
			0,
			-G,
			0
		],
		rot: [
			0,
			e.range(0, W),
			0
		]
	});
	h(_, l * .03, a);
	let v = [g(_, (e, t) => t.y > .8 ? p : m(e, t))];
	if (i.variant === 1 || i.variant === 3) {
		let e = S(f(l * .48, l * .48, .015, 7), { pos: [
			0,
			c + .004,
			0
		] });
		v.push(g(e, q(p, 0, 0, -.08)));
	}
	if (i.variant === 2) {
		let t = J(p, .07), n = e.range(0, W);
		for (let r = 0; r < 3; r++) {
			let i = n + r * W / 3 + e.range(-.4, .4), a = [
				Math.cos(i) * l * .55,
				c - .04,
				Math.sin(i) * l * .55
			], o = $(d(l * .3, l * e.range(.45, .8), 3), a, i + Math.PI, e.range(.05, .3));
			v.push(g(o, (e, n) => n.y > .3 ? t[2] : n.y > -.3 ? t[1] : t[0]));
		}
	}
	let y = i.variant === 2 ? 4 : 3, b = e.range(0, W);
	for (let t = 0; t < y; t++) {
		let n = b + t * W / y + e.range(-.3, .3), r = [
			Math.cos(n) * l * .62,
			c * .22,
			Math.sin(n) * l * .62
		];
		v.push(g($(d(l * .28, l * .95, 3), r, n, e.range(1.75, 1.9)), u[0]));
	}
	if (i.variant === 3) {
		let t = e.range(0, W);
		v.push(..._n([
			Math.cos(t) * l * 1.15,
			0,
			Math.sin(t) * l * 1.15
		], c * .45, e.pick(s.caps), !1, s, e));
	}
	return {
		geometry: w(v),
		colliders: [dn(l, c)]
	};
}
function xn(e, t, n) {
	var r, i;
	let a = K(e, n, [1.4, 1.7]), o = e.fork("jitter"), s = e.fork("paint"), c = Q(t), p = a.height, m = Math.min(16, Math.max(2, (r = en(n, "length")) == null ? 6 : r)), _ = J(Y(q(c.bark, 0, -.04, .08), e), .05), v = J(Y((i = a.colour) == null ? q(c.leafLight, .02, .04, -.04) : i, e), .06), y = J(Y(e.chance(.75) ? c.grape : q(c.leafLight, .04, .1, .06), e), .06), b = [], x = Math.max(2, Math.round(m / 2.5) + 1), C = p + .1 + G;
	for (let t = 0; t < x; t++) {
		let n = -m / 2 + m * t / (x - 1), r = S(u(.1, C, .1, 0), {
			pos: [
				n,
				C / 2 - G,
				0
			],
			rot: [
				0,
				0,
				e.range(-.025, .025)
			]
		});
		b.push(g(r, X(_, s, { top: 0 })));
	}
	for (let e of [.5, .82]) b.push(g(S(u(m, .02, .02, 0), { pos: [
		0,
		p * e,
		0
	] }), c.wire));
	for (let t = 0; t < x - 1; t++) {
		let n = -m / 2 + m * (t + .5) / (x - 1) + e.range(-.3, .3), r = $(f(.03, .05, p * .8 + G, 3), [
			n,
			-G,
			0
		], e.range(0, W), e.range(.03, .1));
		b.push(g(r, _[0]));
	}
	let T = Math.max(2, Math.round(m * 1.3));
	for (let t = 0; t < T; t++) {
		let n = -m / 2 + m * (t + .5) / T + e.range(-.15, .15), r = S(l(.42, 0), {
			pos: [
				n,
				p * .8 + e.range(-.06, .06),
				e.range(-.05, .05)
			],
			rot: [
				0,
				e.range(0, W),
				0
			],
			scale: [
				1.35,
				.85,
				.75
			]
		});
		h(r, .05, o), b.push(g(r, X(v, s, { top: .25 })));
	}
	let E = Math.max(1, Math.round(m));
	for (let t = 0; t < E; t++) {
		let n = -m / 2 + m * (t + .5) / E + e.range(-.2, .2), r = (t % 2 == 0 ? 1 : -1) * e.range(.26, .32), i = S(d(.12, .28, 4), {
			pos: [
				n,
				p * .5 + .28,
				r
			],
			rot: [
				Math.PI,
				e.range(0, W),
				0
			]
		});
		b.push(g(i, X(y, s, { top: .2 })));
	}
	return {
		geometry: w(b),
		colliders: [pn([
			0,
			p / 2,
			0
		], [
			m / 2 + .1,
			p / 2 + .05,
			.4
		])]
	};
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/nature-plants.ts
function Sn(e, t, n) {
	var r;
	let i = K(e, n, [.7, 1.1]), a = e.fork("jitter"), o = e.fork("paint"), s = Q(t), c = i.height, u = c * .62, d = .8, f = c - u * d, p = J(Y((r = i.colour) == null ? q(s.leaf, 0, 0, .03) : r, e), .06), m = q(p[0], 0, 0, -.06), _ = (e, t, n, r, s) => {
		let c = S(l(e, i.lod ? 0 : r), {
			pos: t,
			rot: [
				0,
				s,
				0
			],
			scale: [
				1,
				n,
				1
			]
		});
		return h(c, e * .08, a), un(c, -.04), g(c, X(p, o, {
			top: .25,
			under: m
		}));
	}, v = i.variant === 2 ? 1.35 : 1, y = [S(_(u, [
		0,
		f,
		0
	], d, 1, e.range(0, W)), { scale: [
		v,
		1,
		1
	] })], b = [
		2,
		3,
		1,
		0
	][i.variant], x = e.range(0, W);
	for (let t = 0; t < b; t++) {
		let n = x + t * W / Math.max(b, 2) + e.range(-.35, .35), r = u * e.range(.5, .62), a = u * .78 * (i.variant === 2 ? 1.25 : 1);
		y.push(_(r, [
			Math.cos(n) * a,
			r * .62,
			Math.sin(n) * a
		], .85, 0, e.range(0, W)));
	}
	if (i.variant === 3) {
		let t = J(e.pick(s.fruit), .06);
		for (let n = 0; n < 3; n++) {
			let n = Math.PI * .5 + e.range(-1.1, 1.1), r = e.range(.35, .65) * Math.PI, i = [
				Math.sin(r) * Math.cos(n) * u * .98,
				f + Math.cos(r) * u * d,
				Math.sin(r) * Math.sin(n) * u * .98
			];
			y.push(g(S(l(u * .14, 0), { pos: i }), X(t, o, { top: .3 })));
		}
	}
	return {
		geometry: w(y),
		colliders: [dn(u * .75 * v, c)]
	};
}
function Cn(e, t, n) {
	var r;
	let i = K(e, n, [1.1, 1.6]), a = e.fork("paint"), o = Q(t), s = i.height, c = J(Y((r = i.colour) == null ? o.reed : r, e), .07), l = q(c[2], 0, 0, .04), u = J(Y(o.cattail, e), .05), [p, m] = [
		[6, 1],
		[5, 2],
		[7, 0],
		[4, 2]
	][i.variant], h = [], _ = e.range(0, W);
	for (let t = 0; t < p; t++) {
		let n = _ + t * W / p + e.range(-.4, .4), r = e.range(.03, .2), i = s * e.range(.55, 1) + G, a = [
			Math.cos(n) * r,
			-G,
			Math.sin(n) * r
		], o = $(d(s * .04 * e.range(.8, 1.2), i, 3), a, n, e.range(.06, .3 + r), [
			1,
			1,
			.55
		]);
		h.push(g(o, i > s * .85 ? l : e.pick(c)));
	}
	for (let t = 0; t < m; t++) {
		let n = _ + Math.PI / p + t * Math.PI + e.range(-.3, .3), r = e.range(.02, .1), i = [
			Math.cos(n) * r,
			-G,
			Math.sin(n) * r
		], o = e.range(.02, .12), l = s * e.range(.85, .98);
		h.push(g($(d(s * .013, l, 3), i, n, o), c[0]));
		let m = ln(i, n, o, l * .86), v = s * .16, y = $(f(s * .026, s * .034, v, 4), m, n, o);
		h.push(g(y, X(u, a, { top: .1 })));
	}
	return {
		geometry: w(h),
		colliders: []
	};
}
function wn(e, t, n) {
	var r;
	let i = K(e, n, (e) => e === 2 ? [.5, .7] : e === 1 ? [.28, .4] : [.35, .55]), a = Q(t), o = i.height, s = J(Y((r = i.colour) == null ? a.grass : r, e), .05), c = Y(a.grassTip, e), l = [
		5,
		6,
		4,
		6
	][i.variant], u = [
		.06,
		.072,
		.055,
		.06
	][i.variant], f = e.range(0, W), p = [], m = e.range(0, W);
	for (let t = 0; t < l; t++) {
		let n = m + t * W / l + e.range(-.3, .3), r = e.range(.02, .09), a = o * e.range(.6, 1) + G * .5, h = [
			Math.cos(n) * r,
			-G * .5,
			Math.sin(n) * r
		], _ = i.variant === 3, v = $(d(u * e.range(.85, 1.15), a, 3), h, _ ? f + e.range(-.35, .35) : n, _ ? e.range(.35, .6) : e.range(.12, .5), [
			1,
			1,
			.6
		]);
		p.push(g(v, a > o * .85 ? c : e.pick(s)));
	}
	return {
		geometry: w(p),
		colliders: []
	};
}
function Tn(e, t, n, r, i, a, o, s, c) {
	let l = c.range(0, W), u = c.range(0, .18), f = [g($(d(.016, t + G, 3), [
		e[0],
		-G,
		e[2]
	], l, u), o)], p = ln([
		e[0],
		-G,
		e[2]
	], l, u, t + G), m = S(d(n, r, i), {
		pos: [
			p[0],
			p[1] + r * .65,
			p[2]
		],
		rot: [
			Math.PI + c.range(-.15, .15),
			c.range(0, W),
			c.range(-.15, .15)
		]
	}), h = q(a, 0, 0, .05);
	if (f.push(g(m, (e, t) => t.y > .5 ? h : a)), s) {
		let e = d(n * .32, n * .42, 3);
		f.push(g(S(e, { pos: [
			p[0],
			p[1] + r * .62,
			p[2]
		] }), s));
	}
	return f;
}
function En(e, t, n) {
	var r;
	let i = K(e, n, [.28, .45]), a = Q(t), o = i.height, s = Y(q(a.grass, 0, 0, -.1), e), c = Y((r = i.colour) == null ? e.pick(a.petals) : r, e), l = Y(a.centre, e), u = [], [f, p, m, h, _, v] = [
		[
			2,
			.07,
			.035,
			5,
			!0,
			1
		],
		[
			3,
			.05,
			.075,
			5,
			!1,
			1
		],
		[
			1,
			.1,
			.045,
			6,
			!0,
			2
		],
		[
			3,
			.05,
			.03,
			5,
			!1,
			0
		]
	][i.variant], y = e.range(0, W);
	for (let t = 0; t < f; t++) {
		let n = y + t * W / f, r = f === 1 ? 0 : e.range(.05, .1), d = o * (t === 0 ? 1 : e.range(.7, .92)), g = i.variant === 3 && i.colour === null ? Y(e.pick(a.petals), e) : c, v = o / .36 * 1.35;
		u.push(...Tn([
			Math.cos(n) * r,
			0,
			Math.sin(n) * r
		], d, p * v, m * v, h, g, s, _ ? l : null, e));
	}
	for (let t = 0; t < v; t++) {
		let n = y + Math.PI * (.5 + t), r = $(d(.035, o * .42, 3), [
			0,
			-.02,
			0
		], n, e.range(.9, 1.15), [
			1,
			1,
			.3
		]);
		u.push(g(r, q(s, 0, 0, .04)));
	}
	return {
		geometry: w(u),
		colliders: []
	};
}
function Dn(e, t, n, r) {
	let i = r.range(.28, .4), a = -Math.PI / 2 + i, o = [[0, 0]];
	for (let n = 0; n < t; n++) {
		let s = a + (W - 2 * i) * n / (t - 1), c = e * r.range(.94, 1.04);
		o.push([Math.cos(s) * c, Math.sin(s) * c]);
	}
	return g(S(m(o, .03), {
		rot: [
			-Math.PI / 2,
			0,
			0
		],
		pos: [
			0,
			.005,
			0
		]
	}), (e, t) => t.y > .5 ? r.chance(.3) ? n[2] : n[1] : n[0]);
}
function On(e, t, n) {
	var r;
	let i = K(e, n, [.36, .5]), a = Q(t), o = i.height, s = J(Y(a.lilyPad, e), .05), c = Y((r = i.colour) == null ? a.lilyFlower : r, e), l = [S(Dn(o, 8, s, e), { rot: [
		0,
		e.range(-.6, .6),
		0
	] })];
	if (i.variant >= 2) {
		let t = e.range(0, W), n = o * e.range(.5, .62), r = o + n * .9;
		l.push(S(Dn(n, 6, s, e), {
			pos: [
				Math.cos(t) * r,
				0,
				Math.sin(t) * r
			],
			rot: [
				0,
				e.range(0, W),
				0
			]
		}));
	}
	if (i.variant === 1 || i.variant === 3) {
		let t = o * e.range(-.25, .25), n = o * e.range(-.3, .1), r = o * .32, i = S(d(o * .32, r, 6), {
			pos: [
				t,
				.03 + r,
				n
			],
			rot: [
				Math.PI,
				e.range(0, W),
				0
			]
		});
		h(i, o * .03, e);
		let s = q(c, 0, 0, .06);
		l.push(g(i, (e, t) => t.y > .5 ? s : c)), l.push(g(S(d(o * .1, o * .1, 3), { pos: [
			t,
			.03 + r,
			n
		] }), a.centre));
	}
	return {
		geometry: w(l),
		colliders: []
	};
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/nature-trees.ts
var kn = 20;
function An(e, t, n, r, i, a) {
	return g(S(f(e * .68, e, t + G, n), {
		pos: [
			0,
			-G,
			0
		],
		rot: [
			0,
			i,
			0
		]
	}), X(J(r, .05), a, { top: 0 }));
}
function jn(e, t, n) {
	var r;
	let i = K(e, n, [4.2, 6.4]), a = e.fork("jitter"), o = e.fork("paint"), s = Q(t), c = i.height, l = [
		3,
		4,
		2,
		3
	][i.variant], u = c * [
		.27,
		.21,
		.33,
		.26
	][i.variant], f = Math.max(.12, c * .045), p = c * .17, m = i.lod ? 5 : 7, _ = J(Y((r = i.colour) == null ? s.pine : r, e), .06), v = q(_[0], 0, 0, -.06), y = [An(f, p, i.lod ? 4 : 5, Y(s.bark, e), e.range(0, W), o)], b = p * .75, x = c - b, C = x * (l === 2 ? .64 : l === 3 ? .5 : .4), T = (x - C) / (l - 1), E = e.range(0, W), ee = i.variant === 3 ? u * e.range(.1, .18) : 0;
	for (let t = 0; t < l; t++) {
		let n = t / (l - 1), r = u * (1 - .55 * n) * e.range(.94, 1.06), i = ee * n * n, s = S(d(r, C * e.range(.95, 1.04), m), {
			pos: [
				Math.cos(E) * i,
				b + t * T,
				Math.sin(E) * i
			],
			rot: [
				0,
				e.range(0, W),
				0
			]
		});
		h(s, r * .06, a), y.push(g(s, X(_, o, { under: v })));
	}
	return {
		geometry: w(y),
		colliders: [dn(Math.max(f * 1.5, u * .42), c)]
	};
}
function Mn(e, t) {
	let n = t.range(0, W), r = (e, r, i, a) => Array.from({ length: e }, (o, s) => {
		let c = n + s * W / e + t.range(-.3, .3);
		return {
			r: a * t.range(.9, 1.1),
			x: Math.cos(c) * r,
			y: i,
			z: Math.sin(c) * r,
			sy: .85,
			detail: 0,
			rot: t.range(0, W)
		};
	}), i = (e, n, r) => ({
		r: e,
		x: 0,
		y: n,
		z: 0,
		sy: r,
		detail: 1,
		rot: t.range(0, W)
	});
	switch (e) {
		case 0: return [i(1, 0, .9), ...r(2, .78, -.28, .6)];
		case 1: return [i(.92, .08, .9), ...r(3, .72, -.22, .56)];
		case 2: return [i(.88, .1, 1.28), ...r(1, .62, -.62, .48)];
		default: return [i(1, 0, .82), {
			...i(.7, .95, .88),
			x: t.range(-.12, .12),
			z: t.range(-.12, .12)
		}];
	}
}
function Nn(e, t, n, r, i, a, o) {
	let s = n - Math.max(...e.map((e) => e.y + e.r * e.sy)) * t, c = q(i[0], 0, 0, -.07);
	return {
		parts: e.map((e) => {
			let n = S(l(e.r * t, r ? 0 : e.detail), {
				pos: [
					e.x * t,
					s + e.y * t,
					e.z * t
				],
				rot: [
					0,
					e.rot,
					0
				],
				scale: [
					1,
					e.sy,
					1
				]
			});
			return h(n, e.r * t * .07, a), g(n, X(i, o, {
				top: .25,
				under: c
			}));
		}),
		cy: s
	};
}
function Pn(e, t, n) {
	var r;
	let i = K(e, n, [4, 6]), a = e.fork("jitter"), o = e.fork("paint"), s = Q(t), c = i.height, l = c * .3, u = Math.max(.12, c * .056), f = Y(s.bark, e), p = J(Y((r = i.colour) == null ? s.leaf : r, e), .06), m = e.range(0, W), h = Nn(Mn(i.variant, e), l, c, i.lod, p, a, o), _ = [An(u, h.cy, i.lod ? 4 : 6, f, m, o), ...h.parts];
	if (i.variant === 0) {
		let t = [
			0,
			h.cy * .55,
			0
		], n = $(d(u * .45, l * .7, 4), t, e.range(0, W), .95);
		_.push(g(n, X(J(f, .05), o, { top: 0 })));
	}
	return {
		geometry: w(_),
		colliders: [dn(Math.max(.25, u * 1.5), h.cy + l * .5)]
	};
}
function Fn(e, t, n) {
	var r;
	let i = K(e, n, [3.5, 5.5]), a = e.fork("paint"), o = Q(t), s = i.height, c = Math.max(.1, s * .055), l = J(Y((r = i.colour) == null ? o.barkDead : r, e), .06), u = (e) => g(e, X(l, a, { top: .1 })), p = i.lod ? 4 : 5, m = e.range(0, W), h = e.range(.03, .09), _ = s * .66 + G, v = [
		0,
		-G,
		0
	], y = [u($(f(c * .42, c, _, p), v, m, h))], b = (e) => ln(v, m, h, _ * e), x = [
		3,
		4,
		2,
		5
	][i.variant], S = [
		.36,
		.3,
		.42,
		.26
	][i.variant], C = e.range(0, W), T = (t, n, r, a, o, s) => {
		if (y.push(u($(f(o * .35, o, a, i.lod ? 3 : 4), t, n, r))), !s) return;
		let c = ln(t, n, r, a * .92), l = n + e.sign() * e.range(.5, 1.1);
		y.push(u($(d(o * .3, a * .45, 3), c, l, r * e.range(.4, .8))));
	};
	for (let t = 0; t < x; t++) {
		let n = C + t * W / x + e.range(-.4, .4);
		T(b(e.range(.45, .95)), n, e.range(.55, 1.05), s * S * e.range(.8, 1.15), c * .55, e.chance(.75));
	}
	let E = b(.97);
	T(E, C + .5, e.range(.25, .5), s * .26, c * .4, !1), T(E, C + .5 + Math.PI, e.range(.3, .55), s * .22, c * .36, i.variant === 2);
	let ee = w(y), D = [dn(Math.max(.2, c * 1.4), s * .7)];
	return ee.computeBoundingBox(), mn(ee, D, s / Math.max(.01, ee.boundingBox.max.y)), {
		geometry: ee,
		colliders: D
	};
}
function In(e, t, n) {
	var r;
	let i = n.orchard === !0 || n.orchard === 1, a = K(e, n, i ? [2.8, 3.3] : [2.8, 3.9]), o = e.fork("jitter"), s = e.fork("paint"), c = Q(t), u = a.height, d = u * (i ? .34 : .32), f = Math.max(.1, u * .068), p = J(Y((r = a.colour) == null ? c.fruitLeaf : r, e), .06), m = [{
		r: 1,
		x: 0,
		y: 0,
		z: 0,
		sy: i ? .84 : .92,
		detail: 1,
		rot: e.range(0, W)
	}];
	if (!i && a.variant !== 0) {
		let t = a.variant === 3 ? 2 : 1, n = e.range(0, W);
		for (let r = 0; r < t; r++) {
			let t = n + r * Math.PI + e.range(-.4, .4);
			m.push({
				r: .55,
				x: Math.cos(t) * .75,
				y: -.3,
				z: Math.sin(t) * .75,
				sy: .85,
				detail: 0,
				rot: t
			});
		}
	}
	let h = Y(c.bark, e), _ = e.range(0, W), v = Nn(m, d, u, a.lod, p, o, s), y = [An(f, v.cy, a.lod ? 4 : 6, h, _, s), ...v.parts], b = J(e.pick(c.fruit), .07), x = u / 3.2 * .14, C = 104 + 20 * (m.length - 1), T = i ? 7 : 5 + e.int(0, 3), E = Math.min(T, Math.floor((296 - C) / kn)), ee = m[0], D = e.range(0, W);
	for (let t = 0; t < E; t++) {
		let n = D + t * W / E + e.range(-.25, .25), r = Math.PI * e.range(.32, .7), i = d, a = S(l(x * e.range(.85, 1.1), 0), {
			pos: [
				Math.sin(r) * Math.cos(n) * i,
				v.cy + Math.cos(r) * i * ee.sy,
				Math.sin(r) * Math.sin(n) * i
			],
			scale: [
				1,
				.9,
				1
			]
		});
		y.push(g(a, X(b, s, { top: .3 })));
	}
	return {
		geometry: w(y),
		colliders: [dn(Math.max(.22, f * 1.6), v.cy + d * .5)]
	};
}
function Ln(e, t, n) {
	return In(e, t, {
		...n,
		orchard: !0
	});
}
//#endregion
//#region ../../../../pilgrim/src/gen/props/index.ts
var Rn = {
	tree_cone: jn,
	tree_round: Pn,
	tree_dead: Fn,
	tree_fruit: In,
	fruit_tree_orchard: Ln,
	bush: Sn,
	reeds: Cn,
	grass: wn,
	rock: gn,
	flower: En,
	lily: On,
	mushroom: vn,
	log: yn,
	stump: bn,
	vine_row: xn,
	...Qt
};
function zn(e, t, n, r = {}) {
	if (!Object.hasOwn(Rn, e)) throw Error(`buildProp: unknown prop type "${e}". Known types: ${Object.keys(Rn).sort().join(", ")}`);
	return Rn[e](t, n, r);
}
function Bn(e, t, n, r) {
	let i = Math.cos(n), a = Math.sin(n), [o, s, c] = e.center, l = [
		t[0] + (o * i + c * a) * r,
		t[1] + s * r,
		t[2] + (-o * a + c * i) * r
	];
	switch (e.kind) {
		case "box": return {
			kind: "box",
			center: l,
			half: [
				e.half[0] * r,
				e.half[1] * r,
				e.half[2] * r
			],
			rotY: e.rotY + n
		};
		case "cylinder": return {
			kind: "cylinder",
			center: l,
			radius: e.radius * r,
			height: e.height * r
		};
		case "sphere": return {
			kind: "sphere",
			center: l,
			radius: e.radius * r
		};
	}
}
var Vn = class t {
	constructor(t, n) {
		D(this, "rng", void 0), D(this, "pal", void 0), D(this, "lit", []), D(this, "glow", []), D(this, "colliders", []), D(this, "m", new e.Matrix4()), D(this, "q", new e.Quaternion()), D(this, "p", new e.Vector3()), D(this, "s", new e.Vector3()), this.rng = t, this.pal = n;
	}
	add(e) {
		var n, r, i;
		let [a, o, s] = e.at, c = `${e.type}@${a.toFixed(2)},${o.toFixed(2)},${s.toFixed(2)}`, l = zn(e.type, this.rng.fork(c), this.pal, (n = e.params) == null ? {} : n), u = (r = e.rotY) == null ? 0 : r, d = Math.max(.001, (i = e.scale) == null ? 1 : i);
		this.m.compose(this.p.set(...e.at), this.q.setFromAxisAngle(t.UP, u), this.s.setScalar(d)), l.geometry.applyMatrix4(this.m), this.lit.push(l.geometry), l.glow && (l.glow.applyMatrix4(this.m), this.glow.push(l.glow));
		for (let t of l.colliders) this.colliders.push(Bn(t, e.at, u, d));
	}
	discard() {
		for (let e of [...this.lit, ...this.glow]) e.dispose();
		this.lit.length = 0, this.glow.length = 0;
	}
	finish() {
		let t = new e.Mesh(w(this.lit.splice(0)), ye("lambert"));
		t.name = "props", t.castShadow = !0, t.receiveShadow = !0;
		let n = null;
		this.glow.length > 0 && (n = new e.Mesh(w(this.glow.splice(0)), ye("glow")), n.name = "props:glow");
		let r = this.colliders;
		return {
			mesh: t,
			glow: n,
			colliders: r,
			dispose() {
				t.removeFromParent(), t.geometry.dispose(), n && (n.removeFromParent(), n.geometry.dispose());
			}
		};
	}
};
D(Vn, "UP", new e.Vector3(0, 1, 0));
function Hn(e, t, n) {
	let r = new Vn(t, n);
	try {
		for (let t of e) r.add(t);
	} catch (e) {
		throw r.discard(), e;
	}
	return r.finish();
}
//#endregion
//#region ../../../../pilgrim/src/gen/rng.ts
function Un(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
var Wn = class e {
	constructor(e) {
		D(this, "state", void 0), this.state = e >>> 0 || 2654435769;
	}
	next() {
		let e = this.state = this.state + 1831565813 >>> 0;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	}
	range(e, t) {
		return e + (t - e) * this.next();
	}
	int(e, t) {
		return Math.floor(this.range(e, t + 1));
	}
	chance(e) {
		return this.next() < e;
	}
	pick(e) {
		if (e.length === 0) throw Error("Rng.pick: empty list");
		return e[Math.floor(this.next() * e.length)];
	}
	sign() {
		return this.next() < .5 ? -1 : 1;
	}
	gauss(e = 0, t = 1) {
		let n = 1 - this.next(), r = this.next();
		return e + t * Math.sqrt(-2 * Math.log(n)) * Math.cos(2 * Math.PI * r);
	}
	fork(t) {
		let n = typeof t == "string" ? Un(t) : t >>> 0;
		return new e((Math.imul(this.state ^ n, 2246822507) ^ 3266489909) >>> 0);
	}
};
//#endregion
export { xe as PALETTES, Rn as PROPS, Wn as Rng, zn as buildProp, Se as getPalette, Un as hashString, ye as mat, Hn as placeProps };
