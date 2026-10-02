import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

/**
 * Keeps a render crash in the vault feature from blanking the whole app. Funds are never at risk here: shares live
 * in the user's hub wallet, so the fallback only needs to say that and offer a reload.
 */
export class FeatureErrorBoundary extends Component<{ children: ReactNode }, { error: Error | undefined }> {
  state = { error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[leverage-yield] the vault view crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Callout variant="destructive" className="flex flex-col items-start gap-3">
        <p>
          The vault view hit an error and stopped: {this.state.error.message}. Your shares are safe in your SODAX hub
          wallet; reloading shows them again.
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </Callout>
    );
  }
}
