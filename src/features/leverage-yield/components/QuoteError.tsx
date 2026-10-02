import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';

export function QuoteError({ message, onRetry }: { message: string; onRetry: () => unknown }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive bg-destructive-muted p-3 text-sm text-foreground">
      <span className="min-w-0">
        <span className="block truncate" title={message}>
          {message.split('. ')[0]}
        </span>
        {message.includes('. ') && (
          <Disclosure className="mt-1">
            <span className="break-words text-muted-foreground">{message}</span>
          </Disclosure>
        )}
      </span>
      <Button size="sm" variant="outline" onClick={() => void onRetry()}>
        Retry
      </Button>
    </div>
  );
}
