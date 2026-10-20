import { z } from 'zod';
import { BLOCK_KINDS } from './blocks.ts';

export { BLOCK_KINDS, type BlockKind } from './blocks.ts';
export const BlockKindSchema = z.enum(BLOCK_KINDS);

export const FormatterIdSchema = z.enum(['percent', 'db12', 'db15', 'lowcut', 'highcut', 'tempo', 'switch']);
export type FormatterId = z.infer<typeof FormatterIdSchema>;

export const TempoTableIdSchema = z.enum(['pro', 'proMod', 'proAnalog', 'proTape']);
export type TempoTableId = z.infer<typeof TempoTableIdSchema>;

const byte = z.number().int().min(0).max(255);
const raw100 = z.number().int().min(0).max(100);
const SourceRefSchema = z.object({ file: z.string().min(1), line: z.number().int().positive().optional() });

export const ParamDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  byteIndex: z.number().int().min(0).max(112),
  byteName: z.string().min(1),
  formatter: FormatterIdSchema,
  tempoTable: TempoTableIdSchema.optional(),
  switch: z
    .object({ title: z.string(), labels: z.array(z.string()).min(2), values: z.array(raw100).min(2) })
    .optional(),
  default: raw100,
});
export type ParamDef = z.infer<typeof ParamDefSchema>;

export const ModelDefSchema = z.object({
  id: z.string().regex(/^(gate|comp|efx|amp|eq|mod|dly|rvb|cab)\.[a-z0-9-]+$/),
  block: BlockKindSchema,
  nuxIndex: z.number().int().min(0).max(0x3f),
  name: z.string().min(1),
  className: z.string().min(1),
  category: z.string().optional(),
  hiddenInOfficialApp: z.boolean().optional(),
  defaultCabNuxIndex: z.number().int().optional(),
  userIrSlot: z.number().int().min(1).max(20).optional(),
  notes: z.string().optional(),
  verified: z.boolean(),
  verifiedBy: z.string().optional(),
  params: z.array(ParamDefSchema),
  source: SourceRefSchema,
});
export type ModelDef = z.infer<typeof ModelDefSchema>;

export const BlockDefSchema = z.object({
  headIndex: z.number().int().min(1).max(9),
  models: z.array(ModelDefSchema).min(1),
});

export const DeviceKnowledgeSchema = z.object({
  $comment: z.string(),
  schemaVersion: z.literal(1),
  device: z.literal('mighty-space'),
  deviceName: z.string(),
  protocol: z.literal('plug-pro'),
  firmware: z.string().regex(/^\d{8}$/),
  source: z.object({
    repo: z.string().url(),
    commit: z.string(),
    license: z.literal('MIT'),
    files: z.array(z.string()).min(1),
  }),
  qr: z.object({
    prefix: z.literal('nux://MightyAmp:'),
    deviceQRId: byte,
    deviceQRVersion: byte,
    presetLength: z.literal(113),
    source: z.object({ file: z.string(), note: z.string() }),
  }),
  mspatch: z.object({
    length: z.literal(8404),
    presetOffset: z.literal(4),
    source: z.object({ file: z.string(), note: z.string() }),
  }),
  byteMap: z.record(z.string(), z.number().int().min(0)),
  byteMapSource: SourceRefSchema,
  head: z.object({ modelMask: z.literal(0x3f), offBit: z.literal(0x40) }),
  chain: z.object({
    start: z.number().int(),
    length: z.literal(9),
    maxOffsetSkip: z.number().int().min(0),
    defaultOrder: z.array(BlockKindSchema).length(9),
  }),
  master: z.object({ byteIndex: z.number().int(), formatter: z.literal('db12') }),
  name: z.object({ start: z.number().int(), maxLengthInQr: z.number().int().positive() }),
  userIr: z.object({ first: z.number().int(), count: z.number().int() }),
  tempoTables: z.record(TempoTableIdSchema, z.array(z.number().positive()).length(5)),
  blocks: z.record(BlockKindSchema, BlockDefSchema),
});
export type DeviceKnowledge = z.infer<typeof DeviceKnowledgeSchema>;
