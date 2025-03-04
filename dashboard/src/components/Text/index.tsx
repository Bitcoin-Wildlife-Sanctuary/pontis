import * as Presets from './Presets';
import {TextWrapper} from './TextWrapper';

const Text = TextWrapper as typeof TextWrapper & typeof Presets;

// Add Presets to the Text component. So we can use Text.HeadlineLarge etc.
// Note, this mutates the Text component object.
Object.assign(Text, Presets);

export {Text};
