import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Translation } from 'react-i18next';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught rendering exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch {
        // no-op
      }
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, this.handleReset)
          : this.props.fallback;
      }

      return (
        <Translation>
          {(t) => (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center space-y-4">
              <div className="h-14 w-14 bg-red-500/10 text-destructive rounded-2xl flex items-center justify-center">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg font-bold text-foreground">
                  {this.props.title || t('common.somethingWentWrong', { defaultValue: 'Something went wrong' })}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {this.props.description || t('common.errorTryAgain', { defaultValue: 'An unexpected rendering error occurred. Please refresh or retry.' })}
                </p>
                {this.state.error && (
                  <details className="mt-3 text-start p-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-xs">
                    <summary className="cursor-pointer font-medium text-destructive select-none text-[11px]">
                      {t('common.errorDetails', { defaultValue: 'View error details' })}
                    </summary>
                    <pre className="mt-2 text-[10px] text-destructive/90 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                      {this.state.error.message || String(this.state.error)}
                    </pre>
                  </details>
                )}
              </div>
              <Button
                onClick={this.handleReset}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 text-xs h-9 px-4 mt-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('common.retry', { defaultValue: 'Reload & Retry' })}
              </Button>
            </div>
          )}
        </Translation>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
