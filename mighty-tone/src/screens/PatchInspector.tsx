/**
 * PatchInspector — detailed view of a single patch/tone.
 * S2-A: skeleton only, no logic.
 */
export function PatchInspector() {
  return (
    <div className="flex flex-col h-full bg-black p-4">
      <h1 className="text-white text-xl font-semibold mb-4">Patch Inspector</h1>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-600 text-sm">Select a patch to inspect.</p>
      </div>
    </div>
  );
}
