import { Redirect, useLocalSearchParams } from 'expo-router';

import { LabScreen } from '../../components/LabScreen';
import { labById } from '../../lab/catalog';
import { getLabDef } from '../../lab/labs';

/** Opens a ready lab; labs that aren't built yet send the student back to the list. */
export default function Lab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = labById(id ?? '');
  const def = getLabDef(id ?? '');
  if (!summary?.ready || !def) return <Redirect href="/labs" />;
  return <LabScreen key={def.id} lab={def} />;
}
