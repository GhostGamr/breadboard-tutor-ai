export interface SidePanelBehaviorHost {
  runtime: {
    onInstalled: {
      addListener(listener: () => void): void;
    };
    onStartup: {
      addListener(listener: () => void): void;
    };
  };
  sidePanel: {
    setPanelBehavior(behavior: {
      openPanelOnActionClick: boolean;
    }): Promise<void>;
  };
}

export function installSidePanelBehavior(
  host: SidePanelBehaviorHost,
  onError: (error: unknown) => void = (error: unknown) => {
    console.error('BreadBoard could not set side panel behavior.', error);
  },
): void {
  const apply = (): void => {
    void host.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(onError);
  };

  host.runtime.onInstalled.addListener(apply);
  host.runtime.onStartup.addListener(apply);
  apply();
}
