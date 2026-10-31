/**
 * SessionChat — chat interface for submitting tone requests.
 * S2-A: skeleton only, no logic.
 */
export function SessionChat() {
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <p className="text-zinc-600 text-sm text-center mt-8">
          No messages yet. Describe your tone below.
        </p>
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-800 bg-zinc-950 p-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Describe your tone…"
          className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2 text-sm outline-none placeholder:text-zinc-500"
          readOnly
        />
        <button
          type="button"
          className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium opacity-50"
          disabled
        >
          Send
        </button>
      </div>
    </div>
  );
}
