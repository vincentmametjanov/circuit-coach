import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyzeCircuit, labSteps } from '../lab/circuit';
import { fitCanvas } from '../lab/geometry';
import { SKETCH_NAME, createLab, labReducer } from '../lab/state';
import { colors } from '../theme';
import { ActivityBar, StatusBar, TabStrip, TitleBar, Toolbar } from './ide/Chrome';
import { CodeView } from './ide/CodeView';
import { GuidePanel, NextStepBanner } from './ide/GuidePanel';
import { OutputPanel } from './ide/OutputPanel';
import type { LedGlow } from './workbench/Parts';
import { Workbench } from './workbench/Workbench';

type TabId = 'bench' | 'code' | 'guide';

const BENCH_TAB = { id: 'bench', label: 'Breadboard' };
const CODE_TAB = { id: 'code', label: `${SKETCH_NAME}.ino` };
const GUIDE_TAB = { id: 'guide', label: 'Guide' };

const COMPILE_MS = 700;
const UPLOAD_MS = 1000;
const BLINK_MS = 500;

export function LabScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 900;

  const [lab, dispatch] = useReducer(labReducer, undefined, createLab);
  const [tab, setTab] = useState<TabId>('bench');
  const [guideOpen, setGuideOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const analysis = useMemo(() => analyzeCircuit(lab), [lab]);
  const steps = labSteps(analysis, lab.running);
  const stepsDone = steps.filter((step) => step.done).length;

  // The uploaded sketch: toggle pin 7 every 500 ms.
  useEffect(() => {
    if (!lab.running) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), BLINK_MS);
    return () => clearInterval(id);
  }, [lab.running]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.splice(0).forEach(clearTimeout);
  }, []);

  const later = (ms: number, run: () => void) => {
    timers.current.push(setTimeout(run, ms));
  };

  const verify = () => {
    if (lab.busy !== 'idle') return;
    dispatch({ type: 'compile' });
    later(COMPILE_MS, () => dispatch({ type: 'verifyDone' }));
  };

  const upload = () => {
    if (lab.busy !== 'idle') return;
    dispatch({ type: 'compile' });
    later(COMPILE_MS, () => dispatch({ type: 'uploadStart' }));
    later(COMPILE_MS + UPLOAD_MS, () => dispatch({ type: 'uploadDone' }));
  };

  const reset = () => {
    timers.current.splice(0).forEach(clearTimeout);
    dispatch({ type: 'reset' });
  };

  const { verdict } = analysis;
  let ledGlow: LedGlow = 'off';
  if (!lab.ledBurnt && verdict.code === 'pass' && lab.running && lab.pinHigh) ledGlow = 'on';
  if (!lab.ledBurnt && verdict.code === 'alwaysOn') ledGlow = verdict.source === '3V3' ? 'dim' : 'on';

  const status =
    lab.busy === 'compiling'
      ? 'Compiling…'
      : lab.busy === 'uploading'
        ? 'Uploading…'
        : lab.running
          ? `Running ${SKETCH_NAME}`
          : 'No sketch uploaded';
  const statusLeft = `Lab 01 · ${stepsDone}/${steps.length} steps`;
  const statusRight = `${status}   ·   Arduino Uno on sim-usb0`;

  const toolbar = (
    <Toolbar
      busy={lab.busy !== 'idle'}
      compact={!wide}
      running={lab.running}
      onVerify={verify}
      onUpload={upload}
      onReset={reset}
    />
  );

  const renderBench = (width: number, height: number | null) => {
    const { layout, scale } = fitCanvas(width, height);
    return (
      <Workbench
        layout={layout}
        scale={scale}
        lab={lab}
        ledGlow={ledGlow}
        dispatch={dispatch}
        onDraggingChange={setDragging}
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
        <TitleBar title={`${SKETCH_NAME} | Circuit Coach`} />
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
          {guideOpen ? (
            <View style={styles.sidebar}>
              <GuidePanel steps={steps} />
            </View>
          ) : null}
          <View style={styles.main}>
            <TabStrip tabs={[BENCH_TAB, CODE_TAB]} active={mainTab} onSelect={(id) => setTab(id as TabId)} />
            <View style={styles.editorArea} onLayout={(event) => setArea(event.nativeEvent.layout)}>
              {mainTab === 'code' ? (
                <CodeView />
              ) : area ? (
                <View style={styles.benchCenter}>{renderBench(area.width - 32, area.height - 32)}</View>
              ) : null}
            </View>
            <OutputPanel lines={lab.log} height={180} onClear={() => dispatch({ type: 'clearLog' })} />
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
      <TabStrip tabs={[BENCH_TAB, CODE_TAB, GUIDE_TAB]} active={tab} onSelect={(id) => setTab(id as TabId)} />
      <ScrollView style={styles.narrowScroll} scrollEnabled={!dragging} contentContainerStyle={styles.narrowContent}>
        {tab === 'bench' ? (
          <View style={styles.narrowBench}>
            <NextStepBanner steps={steps} />
            <View onLayout={(event) => setArea(event.nativeEvent.layout)}>
              {area ? renderBench(area.width, null) : null}
            </View>
          </View>
        ) : null}
        {tab === 'code' ? (
          <View style={styles.narrowCode}>
            <CodeView />
          </View>
        ) : null}
        {tab === 'guide' ? <GuidePanel steps={steps} scrollable={false} /> : null}
        <OutputPanel lines={lab.log} height={220} onClear={() => dispatch({ type: 'clearLog' })} />
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
