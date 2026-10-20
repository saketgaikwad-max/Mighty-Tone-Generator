/**
 * One-off extractor: reads the MIT-licensed mightier_amp Dart sources (Plug Pro / Mighty Space)
 * from a local clone and writes knowledge/device/mighty-space.json.
 *
 * Usage: npm run extract [-- <path-to-mightier_amp>]
 * Default source path: ../.research/mightier_amp (not committed). CI only validates the committed JSON.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcRoot = resolve(process.argv[2] ?? join(root, '..', '.research', 'mightier_amp'));
const devicesDir = join(srcRoot, 'lib', 'bluetooth', 'devices');
const rel = (p: string) => p.slice(srcRoot.length + 1);

const overrides = JSON.parse(readFileSync(join(here, 'plugpro-overrides.json'), 'utf8')) as {
  hiddenAmpNuxIndexes: number[];
  hiddenAmpNote: string;
  verified: Record<string, string>;
};

function read(file: string): string {
  return readFileSync(join(devicesDir, file), 'utf8');
}

function lineOf(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

// ---------- byte map ----------
const constantsFile = 'NuxConstants.dart';
const constantsText = read(constantsFile);
const ppStart = constantsText.indexOf('class PresetDataIndexPlugPro');
const ppEnd = constantsText.indexOf('\n}', ppStart);
const ppBody = constantsText.slice(ppStart, ppEnd);
const byteMap: Record<string, number> = {};
for (const m of ppBody.matchAll(/static const (\w+) = (\d+);/g)) byteMap[m[1]!] = Number(m[2]);
const byteMapLine = lineOf(constantsText, ppStart);

function byteIndex(name: string): number {
  const v = byteMap[name];
  if (v === undefined) throw new Error(`Unknown PresetDataIndexPlugPro.${name}`);
  return v;
}

// ---------- formatters ----------
type FormatterId =
  | 'percent'
  | 'db12'
  | 'db15'
  | 'lowcut'
  | 'highcut'
  | 'tempo'
  | 'switch';

interface FormatterInfo {
  id: FormatterId;
  min: number;
  max: number;
  tempoTable?: 'pro' | 'proMod' | 'proAnalog' | 'proTape';
  switchClass?: string;
}

const FORMATTERS: Record<string, FormatterInfo> = {
  percentageMPPro: { id: 'percent', min: 0, max: 100 },
  decibelMPPro: { id: 'db12', min: -12, max: 12 },
  decibelEQ: { id: 'db15', min: -15, max: 15 },
  lowFreqFormatter: { id: 'lowcut', min: 20, max: 300 },
  highFreqFormatter: { id: 'highcut', min: 0, max: 100 },
  tempoPro: { id: 'tempo', min: 0, max: 100, tempoTable: 'pro' },
  tempoProMod: { id: 'tempo', min: 0, max: 100, tempoTable: 'proMod' },
  tempoProAnalog: { id: 'tempo', min: 0, max: 100, tempoTable: 'proAnalog' },
  tempoProTapeEcho: { id: 'tempo', min: 0, max: 100, tempoTable: 'proTape' },
  brightModePro: { id: 'switch', min: 0, max: 100, switchClass: 'BrightModeFormatterMPPro' },
  boostModePro: { id: 'switch', min: 0, max: 100, switchClass: 'BoostModeFormatterMPPro' },
  vibeModePro: { id: 'switch', min: 0, max: 100, switchClass: 'VibeModeFormatterPro' },
  scfMode: { id: 'switch', min: 0, max: 100, switchClass: 'SCFModeFormatter' },
  touchWahFormatterLiteMk2: {
    id: 'switch',
    min: 0,
    max: 100,
    switchClass: 'TouchWahModeFormatterLiteMk2',
  },
  touchWahDirectionFormatterPro: {
    id: 'switch',
    min: 0,
    max: 100,
    switchClass: 'TouchWahDirectionFormatterPro',
  },
};

const switchFile = 'value_formatters/SwitchFormatters.dart';
const switchText = read(switchFile);
function switchDef(cls: string): { title: string; labels: string[]; values: number[] } {
  const start = switchText.indexOf(`class ${cls} extends`);
  if (start < 0) throw new Error(`Switch formatter ${cls} not found`);
  const body = switchText.slice(start, switchText.indexOf('\n}', start));
  const title = /labelTitle => "([^"]*)"/.exec(body)?.[1] ?? '';
  const labels = [...(/labelValues => \[([^\]]*)\]/.exec(body)?.[1] ?? '').matchAll(/"([^"]*)"/g)].map(
    (m) => m[1]!,
  );
  const values = (/midiValues => \[([^\]]*)\]/.exec(body)?.[1] ?? '')
    .split(',')
    .map((s) => Number(s.trim()));
  return { title, labels, values };
}

const tempoFile = 'value_formatters/TempoFormatter.dart';
const tempoText = read(tempoFile);
function tempoTable(cls: string): number[] {
  const start = tempoText.indexOf(`class ${cls} extends`);
  const m = /delayTimeMstable = \[([^\]]*)\]/.exec(tempoText.slice(start));
  if (!m) throw new Error(`Tempo table for ${cls} not found`);
  return m[1]!
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

// ---------- effect classes ----------
interface RawParam {
  label: string;
  key: string;
  value: number;
  formatter: string;
  byteName: string;
}
interface RawClass {
  className: string;
  base: string;
  file: string;
  line: number;
  name?: string;
  nuxIndex?: number;
  category?: string;
  defaultCabClass?: string;
  headName?: string;
  params?: RawParam[];
}

function parseParams(body: string): RawParam[] | undefined {
  const listStart = body.indexOf('List<Parameter> parameters = [');
  if (listStart < 0) return undefined;
  const out: RawParam[] = [];
  const chunks = body.slice(listStart).split('Parameter(').slice(1);
  for (const chunk of chunks) {
    const label = /name: "([^"]*)"/.exec(chunk)?.[1];
    const key = /handle: "([^"]*)"/.exec(chunk)?.[1];
    const value = /value: (-?[\d.]+)/.exec(chunk)?.[1];
    const formatter = /formatter: ValueFormatters\.(\w+)/.exec(chunk)?.[1];
    const byteName = /devicePresetIndex: PresetDataIndexPlugPro\.(\w+)/.exec(chunk)?.[1];
    if (!label || !key || value === undefined || !formatter || !byteName) {
      throw new Error(`Unparsable Parameter block: ${chunk.slice(0, 200)}`);
    }
    out.push({ label, key, value: Number(value), formatter, byteName });
  }
  return out;
}

function parseClasses(file: string): Map<string, RawClass> {
  const text = read(file);
  const classes = new Map<string, RawClass>();
  const re = /^(?:abstract )?class (\w+) extends (\w+)/gm;
  const starts = [...text.matchAll(re)];
  starts.forEach((m, i) => {
    const begin = m.index!;
    const end = i + 1 < starts.length ? starts[i + 1]!.index! : text.length;
    const body = text.slice(begin, end);
    const nuxIdx =
      /int get nuxIndex => (\d+);/.exec(body)?.[1] ?? /static int get cabIndex => (\d+);/.exec(body)?.[1];
    classes.set(m[1]!, {
      className: m[1]!,
      base: m[2]!,
      file: `lib/bluetooth/devices/${file}`,
      line: lineOf(text, begin),
      name:
        /final name = "([^"]*)"/.exec(body)?.[1] ??
        /String get name => "([^"]*)"/.exec(body)?.[1] ??
        /final cabName = "([^"]*)"/.exec(body)?.[1],
      nuxIndex: nuxIdx === undefined ? undefined : Number(nuxIdx),
      category: /String (?:get )?category (?:=|=>) "([^"]*)"/.exec(body)?.[1],
      defaultCabClass: /int get defaultCab => (\w+)\.cabIndex/.exec(body)?.[1],
      headName: /nuxEffectTypeIndex => PresetDataIndexPlugPro\.(\w+)/.exec(body)?.[1],
      get params() {
        return parseParams(body);
      },
    });
  });
  return classes;
}

const effectFiles = {
  comp: 'effects/plug_pro/Compressor.dart',
  efx: 'effects/plug_pro/EFX.dart',
  amp: 'effects/plug_pro/Amps.dart',
  eq: 'effects/plug_pro/EQ.dart',
  gate: 'effects/NoiseGate.dart',
  mod: 'effects/plug_pro/Modulation.dart',
  dly: 'effects/plug_pro/Delay.dart',
  rvb: 'effects/plug_pro/Reverb.dart',
  cab: 'effects/plug_pro/Cabinet.dart',
} as const;
type BlockKind = keyof typeof effectFiles;

const classesByFile = new Map<string, Map<string, RawClass>>();
for (const f of new Set(Object.values(effectFiles))) classesByFile.set(f, parseClasses(f));

function resolveField<K extends keyof RawClass>(
  cls: RawClass,
  map: Map<string, RawClass>,
  field: K,
): RawClass[K] {
  let cur: RawClass | undefined = cls;
  while (cur) {
    if (cur[field] !== undefined) return cur[field];
    cur = map.get(cur.base);
  }
  return undefined as RawClass[K];
}

// ---------- preset constructor lists ----------
const presetFile = 'presets/PlugProPreset.dart';
const presetText = read(presetFile);
function listClasses(listName: string): string[] {
  const m = new RegExp(`${listName}\\.addAll\\(\\[([^\\]]*)\\]`).exec(presetText);
  if (!m) throw new Error(`List ${listName} not found in ${presetFile}`);
  return [...m[1]!.matchAll(/(\w+)\(\)/g)].map((x) => x[1]!);
}
const lists: Record<Exclude<BlockKind, 'gate'>, string> = {
  comp: '_compressorList',
  efx: 'efxList',
  amp: 'amplifierList',
  eq: 'eqList',
  mod: 'modulationList',
  dly: 'delayList',
  rvb: '_reverbList',
  cab: 'cabinetList',
};

const commText = read('communication/plugProCommunication.dart');
const customIRStart = Number(/customIRStart = (\d+);/.exec(commText)![1]);
const customIRsCount = Number(/customIRsCount = (\d+);/.exec(commText)![1]);

// ---------- build ----------
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function rawDefault(p: RawParam, f: FormatterInfo): number {
  if (f.id === 'switch') return Math.round(p.value);
  return Math.round(((p.value - f.min) / (f.max - f.min)) * 100);
}

interface ParamOut {
  key: string;
  label: string;
  byteIndex: number;
  byteName: string;
  formatter: FormatterId;
  tempoTable?: string;
  switch?: { title: string; labels: string[]; values: number[] };
  default: number;
}

function buildParams(params: RawParam[]): ParamOut[] {
  return params.map((p) => {
    const f = FORMATTERS[p.formatter];
    if (!f) throw new Error(`Unmapped formatter ${p.formatter}`);
    const out: ParamOut = {
      key: p.key,
      label: p.label,
      byteIndex: byteIndex(p.byteName),
      byteName: p.byteName,
      formatter: f.id,
      default: rawDefault(p, f),
    };
    if (f.tempoTable) out.tempoTable = f.tempoTable;
    if (f.switchClass) out.switch = switchDef(f.switchClass);
    return out;
  });
}

const headIndex: Record<BlockKind, number> = {
  comp: byteIndex('Head_iCMP'),
  efx: byteIndex('Head_iEFX'),
  amp: byteIndex('Head_iAMP'),
  eq: byteIndex('Head_iEQ'),
  gate: byteIndex('Head_iNG'),
  mod: byteIndex('Head_iMOD'),
  dly: byteIndex('Head_iDLY'),
  rvb: byteIndex('Head_iRVB'),
  cab: byteIndex('Head_iCAB'),
};

const blocks: Record<string, unknown> = {};
const cabClasses = classesByFile.get(effectFiles.cab)!;

for (const block of Object.keys(effectFiles) as BlockKind[]) {
  const map = classesByFile.get(effectFiles[block])!;
  const classNames = block === 'gate' ? ['NoiseGatePro'] : listClasses(lists[block]);
  const models: unknown[] = [];
  const seen = new Set<string>();
  for (const cn of classNames) {
    if (cn === 'UserCab') continue;
    const cls = map.get(cn);
    if (!cls) throw new Error(`Class ${cn} not found in ${effectFiles[block]}`);
    const name = resolveField(cls, map, 'name');
    const nuxIndex = cls.nuxIndex;
    const params = resolveField(cls, map, 'params');
    if (!name || nuxIndex === undefined || !params) throw new Error(`Incomplete class ${cn}`);
    let id = `${block}.${slug(name)}`;
    if (seen.has(id)) id = `${id}-${nuxIndex}`;
    seen.add(id);
    const model: Record<string, unknown> = {
      id,
      block,
      nuxIndex,
      name,
      className: cn,
    };
    if (cls.category) model.category = cls.category;
    if (block === 'amp' && overrides.hiddenAmpNuxIndexes.includes(nuxIndex)) {
      model.hiddenInOfficialApp = true;
      model.notes = overrides.hiddenAmpNote;
    }
    if (block === 'amp' && cls.defaultCabClass) {
      const cab = cabClasses.get(cls.defaultCabClass);
      if (cab?.nuxIndex !== undefined) model.defaultCabNuxIndex = cab.nuxIndex;
    }
    model.verified = id in overrides.verified;
    if (id in overrides.verified) model.verifiedBy = overrides.verified[id];
    model.params = buildParams(params);
    model.source = { file: cls.file, line: cls.line };
    models.push(model);
  }
  if (block === 'cab') {
    const base = cabClasses.get('CabinetPro')!;
    const userCab = cabClasses.get('UserCab')!;
    for (let i = 0; i < customIRsCount; i++) {
      const nuxIndex = i + customIRStart + 1;
      const id = `cab.user-ir-${i + 1}`;
      models.push({
        id,
        block,
        nuxIndex,
        name: `User IR ${i + 1}`,
        className: 'UserCab',
        category: 'User IRs',
        userIrSlot: i + 1,
        notes:
          'User IR slot; the QR payload stores only the slot index, never the IR name or audio. IR names live in the app/amp and in the in-app IR inventory.',
        verified: id in overrides.verified,
        ...(id in overrides.verified ? { verifiedBy: overrides.verified[id] } : {}),
        params: buildParams(base.params!),
        source: { file: userCab.file, line: userCab.line },
      });
    }
  }
  blocks[block] = { headIndex: headIndex[block], models };
}

function gitCommit(dir: string): string {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const defaultEffects = /static const defaultEffects = \[([^\]]*)\]/
  .exec(ppBody)![1]!
  .split(',')
  .map((s) => s.trim().replace('PlugProFXID.', ''))
  .filter(Boolean);
const fxidToBlock: Record<string, BlockKind> = {
  gate: 'gate',
  comp: 'comp',
  mod: 'mod',
  efx: 'efx',
  amp: 'amp',
  cab: 'cab',
  eq: 'eq',
  reverb: 'rvb',
  delay: 'dly',
};

const out = {
  $comment:
    'GENERATED by tools/extract-plugpro.ts from mightier_amp (MIT, (c) 2020-2021 Dian Iliev "Tuntorius"). Do not edit by hand; edit tools/plugpro-overrides.json and re-run `npm run extract`.',
  schemaVersion: 1,
  device: 'mighty-space',
  deviceName: 'NUX Mighty Space',
  protocol: 'plug-pro',
  firmware: '20230331',
  source: {
    repo: 'https://github.com/tuntorius/mightier_amp',
    commit: gitCommit(srcRoot),
    license: 'MIT',
    files: [
      rel(join(devicesDir, constantsFile)),
      rel(join(devicesDir, presetFile)),
      rel(join(devicesDir, switchFile)),
      rel(join(devicesDir, tempoFile)),
      ...[...new Set(Object.values(effectFiles))].map((f) => `lib/bluetooth/devices/${f}`),
    ],
  },
  qr: {
    prefix: 'nux://MightyAmp:',
    deviceQRId: 15,
    deviceQRVersion: 1,
    presetLength: 113,
    source: { file: 'lib/bluetooth/devices/NuxMightyPlugPro.dart', note: 'deviceQRId/deviceQRVersion; qrDataLength in PlugProPreset.dart' },
  },
  mspatch: {
    length: 8404,
    presetOffset: 4,
    source: { file: 'mighty-patch-convert/converter.js', note: 'openPatchFile/openQRFile' },
  },
  byteMap,
  byteMapSource: { file: `lib/bluetooth/devices/${constantsFile}`, line: byteMapLine },
  head: { modelMask: 0x3f, offBit: 0x40 },
  chain: {
    start: byteMap.LINK1,
    length: 9,
    maxOffsetSkip: 3,
    defaultOrder: defaultEffects.map((f) => fxidToBlock[f]),
  },
  master: { byteIndex: byteMap.MASTER, formatter: 'db12' },
  name: { start: byteMap.UserName1, maxLengthInQr: 113 - byteMap.UserName1! },
  userIr: { first: customIRStart + 1, count: customIRsCount },
  tempoTables: {
    pro: tempoTable('TempoFormatterPro'),
    proMod: tempoTable('TempoFormatterProMod'),
    proAnalog: tempoTable('TempoFormatterProAnalog'),
    proTape: tempoTable('TempoFormatterProTapeEcho'),
  },
  blocks,
};

const target = join(root, 'knowledge', 'device', 'mighty-space.json');
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
const counts = Object.fromEntries(
  Object.entries(blocks).map(([k, v]) => [k, (v as { models: unknown[] }).models.length]),
);
console.log(`Wrote ${target.slice(root.length + 1)}`, counts);
