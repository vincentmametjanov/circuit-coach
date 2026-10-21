import { LabScreen } from '../components/LabScreen';
import { FREEPLAY } from '../lab/labs/freeplay';

/** The open bench: free play with every part from the labs, live from the start. */
export default function Play() {
  return <LabScreen key="play" lab={FREEPLAY} autoRun />;
}
