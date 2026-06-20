import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export class SuitcaseErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Suitcase caught rendering error:", error, errorInfo);
  }

  handleReset = async () => {
    try {
      await api.deleteSuitcaseActive();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Suitcase Data Error</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We encountered a critical error while loading your suitcase. The AI stylist may have generated an incompatible plan structure.
            </p>
          </div>
          <Button onClick={this.handleReset} variant="destructive" className="rounded-xl">
            Reset Suitcase & Restart
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
