import { describe, expect, it } from 'vitest';
import { buildHandoffPrompt, parseHandoffResponse } from '../../src/llm/handoff.ts';

describe('llm/handoff', () => {
  it('UNIT-HO-01 parseHandoffResponse extracts valid Intent from a pasted JSON block', () => {
    const text = `{"archetype":"crunch","descriptors":["warm","bright"],"deltas":{"amp.gain":15}}`;
    const intent = parseHandoffResponse(text);
    expect(intent).not.toBeNull();
    expect(intent!.archetype).toBe('crunch');
    expect(intent!.descriptors).toContain('warm');
    expect(intent!.deltas['amp.gain']).toBe(15);
  });

  it('UNIT-HO-02 parseHandoffResponse extracts JSON from markdown code fence', () => {
    const text = `Here is your JSON:\n\`\`\`json\n{"archetype":"metal","descriptors":["heavy"],"deltas":{"amp.gain":30}}\n\`\`\``;
    const intent = parseHandoffResponse(text);
    expect(intent).not.toBeNull();
    expect(intent!.archetype).toBe('metal');
  });

  it('UNIT-HO-03 parseHandoffResponse returns null on garbage input', () => {
    expect(parseHandoffResponse('this is not json at all')).toBeNull();
    expect(parseHandoffResponse('')).toBeNull();
    expect(parseHandoffResponse('null')).toBeNull();
    expect(parseHandoffResponse('{}')).toBeNull(); // missing required fields
  });

  it('UNIT-HO-04 parseHandoffResponse returns null on partial/invalid JSON object', () => {
    // Missing descriptors and deltas
    expect(parseHandoffResponse('{"archetype":"clean"}')).toBeNull();
  });

  it('UNIT-HO-05 buildHandoffPrompt includes the tone description', () => {
    const prompt = buildHandoffPrompt('warm jazz clean', 'electric-humbucker');
    expect(prompt).toContain('warm jazz clean');
    expect(prompt).toContain('electric-humbucker');
    expect(prompt).toContain('archetype');
    expect(prompt).toContain('descriptors');
    expect(prompt).toContain('deltas');
  });

  it('UNIT-HO-06 buildHandoffPrompt works without instrument', () => {
    const prompt = buildHandoffPrompt('heavy metal distortion');
    expect(prompt).toContain('heavy metal distortion');
    expect(prompt).not.toContain('undefined');
  });
});
