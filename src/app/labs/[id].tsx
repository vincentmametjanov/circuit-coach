import { Redirect, useLocalSearchParams } from 'expo-router';

import { LabScreen } from '../../components/LabScreen';
import { labById } from '../../lab/catalog';

/** Opens a ready lab; labs that aren't built yet send the student back to the list. */
export default function Lab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lab = labById(id ?? '');
  if (!lab?.ready) return <Redirect href="/labs" />;
  return <LabScreen />;
}
