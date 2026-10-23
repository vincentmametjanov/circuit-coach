import { router } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ComponentId } from '../lab/components';
import { binRowsForCount, fitCanvas } from '../lab/geometry';
import type { LabDef } from '../lab/lab';
import { binGroups, binRowsFor, type PartSpec } from '../lab/parts';
import {
  type RuntimeAction,
  type RuntimeState,
  createLabStore,
  judge,
  ledGlowFor,
  runtimeReducer,
  runtimeSteps,
} from '../lab/runtime';
import { colors } from '../theme';
import { ActivityBar, StatusBar, TabStrip, TitleBar, Toolbar } from './ide/Chrome';
import { CodeView } from './ide/CodeView';
import { ComponentCard } from './ide/ComponentCard';
import { GuidePanel, NextStepBanner } from './ide/GuidePanel';
import { OutputPanel } from './ide/OutputPanel';
import { SerialPanel } from './ide/SerialPanel';
import { Workbench } from './workbench/Workbench';

type TabId = 'bench' | 'code' | 'guide' | 'serial';

const COMPILE_MS = 700;
const UPLOAD_MS = 1000;

/**
 * Bin rows the canvas needs for this lab. A categorized bin (free play) shows
 * one category at a time, so it sizes for the largest category, not the whole
 * parts list.
 */
function binRowsForLab(lab: LabDef): 1 | 2 | 3 {
  const categorized = lab.parts.filter((p) => p.category);
  if (categorized.length === 0) return binRowsFor(lab.parts);
  const perCategory = new Map<string, PartSpec[]>();
  for (const spec of categorized) perCategory.set(spec.category!, [...(perCategory.get(spec.category!) ?? []), spec]);
  const maxGroups = Math.max(...[...perCategory.values()].map((specs) => binGroups(specs).length));
  return binRowsForCount(maxGroups);
}

/** The lab screen drives any lab defined in src/lab/labs/ through the runtime. */
export function LabScreen({ lab, autoRun = false }: { lab: LabDef; /** Free play: the bench starts already live. */ autoRun?: boolean }) {
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 900;

  const [state, dispatch] = useReducer(
    (s: RuntimeState, a: RuntimeAction) => runtimeReducer(lab, s, a),
    lab,
    (l) => createLabStore(l).state,
  );
  const [tab, setTab] = useState<TabId>('bench');
  const [guideOpen, setGuideOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [inspected, setInspected] = useState<ComponentId | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Free play has nothing to upload: power the bench as soon as it opens.
  useEffect(() => {
    if (autoRun) dispatch({ type: 'uploadDone' });
  }, [autoRun]);

  const verdict = useMemo(() => judge(lab, state), [lab, state]);
  const steps = runtimeSteps(lab, state, state.running);
  const stepsDone = steps.filter((step) => step.done).length;

  // The behavior model's clock, while the sketch runs.
  const tickMs = lab.behavior.tickMs;
  useEffect(() => {
    if (!state.running || !tickMs) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), tickMs);
    return () => clearInterval(id);
  }, [state.running, tickMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.splice(0).forEach(clearTimeout);
  }, []);

  const later = (ms: number, run: () => void) => {
    timers.current.push(setTimeout(run, ms));
  };

  const verify = () => {
    if (state.busy !== 'idle') return;
    dispatch({ type: 'compile' });
    later(COMPILE_MS, () => dispatch({ type: 'verifyDone' }));
  };

  const upload = () => {
    if (state.busy !== 'idle') return;
    dispatch({ type: 'compile' });
    later(COMPILE_MS, () => dispatch({ type: 'uploadStart' }));
    later(COMPILE_MS + UPLOAD_MS, () => dispatch({ type: 'uploadDone' }));
  };

  const reset = () => {
    timers.current.splice(0).forEach(clearTimeout);
    dispatch({ type: 'reset' });
  };

  // How each LED glows comes from the wiring and the pins the sketch drives HIGH.
  const ledGlow = useMemo(() => ledGlowFor(lab, state), [lab, state]);
  // PWM labs give each LED a brightness level instead of an on/off state.
  const ledLevels = useMemo(
    () => lab.behavior.ledLevels?.(lab, { lab, state }) ?? {},
    [lab, state],
  );

  const sketch = lab.sketch.name;
  const status =
    state.busy === 'compiling'
      ? 'Compiling…'
      : state.busy === 'uploading'
        ? 'Uploading…'
        : state.running
          ? `Running ${sketch}`
          : 'No sketch uploaded';
  const statusLeft = `${lab.title.split('·')[0].trim()} · ${stepsDone}/${steps.length} steps`;
  const statusRight = `${status}   ·   Arduino Uno on sim-usb0`;

  const toolbar = (
    <Toolbar
      busy={state.busy !== 'idle'}
      compact={!wide}
      running={state.running}
      onVerify={verify}
      onUpload={upload}
      onReset={reset}
      onHome={() => router.navigate('/labs')}
    />
  );

  const BENCH_TAB = { id: 'bench', label: 'Breadboard' };
  const CODE_TAB = { id: 'code', label: `${sketch}.ino` };
  const GUIDE_TAB = { id: 'guide', label: 'Guide' };
  const SERIAL_TAB = { id: 'serial', label: 'Serial' };
  const hasSerial = !!lab.behavior.analogReads || state.serial.length > 0;

  const renderBench = (width: number, height: number | null) => {
    const { layout, scale } = fitCanvas(width, height, binRowsForLab(lab));
    return (
      <Workbench
        layout={layout}
        scale={scale}
        lab={lab}
        state={state}
        ledGlow={ledGlow}
        ledLevels={ledLevels}
        dispatch={dispatch}
        onDraggingChange={setDragging}
        onInspect={setInspected}
      />
    );
  };

  if (wide) {
    const selectActivity = (id: string) => {
      if (id === 'guide') setGuideOpen((open) => !open);
      else setTab(id as TabId);
    };
    const mainTab = tab === 'guide' ? 'bench' : tab;
    return (
      <SafeAreaView style={styles.root}>
        <ExpoStatusBar style="light" />
        <TitleBar title={`${sketch} | Circuit Coach`} />
        {toolbar}
        <View style={styles.body}>
          <ActivityBar
            items={[
              { id: 'guide', icon: 'guide', label: 'Toggle lab guide' },
              { id: 'bench', icon: 'board', label: 'Breadboard' },
              { id: 'code', icon: 'file', label: 'Sketch' },
            ]}
            active={[guideOpen ? 'guide' : '', mainTab]}
            onSelect={selectActivity}
          />
          {guideOpen || inspected ? (
            <View style={styles.sidebar}>
              {inspected ? (
                <View style={styles.sidebarCard}>
                  <ComponentCard id={inspected} onClose={() => setInspected(null)} />
                </View>
              ) : null}
              {guideOpen ? <GuidePanel lab={lab} steps={steps} passed={verdict.code === 'pass'} /> : null}
            </View>
          ) : null}
          <View style={styles.main}>
            <TabStrip
              tabs={hasSerial ? [BENCH_TAB, CODE_TAB, SERIAL_TAB] : [BENCH_TAB, CODE_TAB]}
              active={mainTab}
              onSelect={(id) => setTab(id as TabId)}
            />
            <View style={styles.editorArea} onLayout={(event) => setArea(event.nativeEvent.layout)}>
              {mainTab === 'code' ? (
                <CodeView sketch={lab.sketch} />
              ) : mainTab === 'serial' ? (
                <SerialPanel lines={state.serial} height={(area?.height ?? 420) - 32} />
              ) : area ? (
                <View style={styles.benchCenter}>{renderBench(area.width - 32, area.height - 32)}</View>
              ) : null}
            </View>
            <OutputPanel lines={state.log} height={180} onClear={() => dispatch({ type: 'clearLog' })} />
          </View>
        </View>
        <StatusBar left={statusLeft} right={statusRight} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ExpoStatusBar style="light" />
      {toolbar}
      <TabStrip
        tabs={hasSerial ? [BENCH_TAB, CODE_TAB, SERIAL_TAB, GUIDE_TAB] : [BENCH_TAB, CODE_TAB, GUIDE_TAB]}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
      />
      <ScrollView style={styles.narrowScroll} scrollEnabled={!dragging} contentContainerStyle={styles.narrowContent}>
        {tab === 'bench' ? (
          <View style={styles.narrowBench}>
            <NextStepBanner steps={steps} doneText={lab.behavior.success ?? 'Every step is done.'} />
            {inspected ? <ComponentCard id={inspected} onClose={() => setInspected(null)} /> : null}
            <View onLayout={(event) => setArea(event.nativeEvent.layout)}>
              {area ? renderBench(area.width, null) : null}
            </View>
          </View>
        ) : null}
        {tab === 'code' ? (
          <View style={styles.narrowCode}>
            <CodeView sketch={lab.sketch} />
          </View>
        ) : null}
        {tab === 'serial' ? <SerialPanel lines={state.serial} height={320} /> : null}
        {tab === 'guide' ? <GuidePanel lab={lab} steps={steps} passed={verdict.code === 'pass'} scrollable={false} /> : null}
        <OutputPanel lines={state.log} height={220} onClear={() => dispatch({ type: 'clearLog' })} />
      </ScrollView>
      <StatusBar left={statusLeft} right={status} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.titleBar,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.editor,
  },
  sidebar: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: colors.panelBorder,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  editorArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  sidebarCard: {
    padding: 12,
    paddingBottom: 0,
    backgroundColor: colors.panel,
  },
  benchCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  narrowScroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  narrowContent: {
    flexGrow: 1,
  },
  narrowBench: {
    padding: 12,
    gap: 12,
  },
  narrowCode: {
    minHeight: 420,
  },
});
