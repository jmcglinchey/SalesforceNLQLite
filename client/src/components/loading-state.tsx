import { Loader2 } from "lucide-react";

export default function LoadingState() {
  return (
    <section className="mb-8">
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-slate-600 font-medium">Analyzing your question...</span>
        </div>
      </div>
    </section>
  );
}
