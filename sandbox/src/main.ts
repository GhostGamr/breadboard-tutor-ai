import { createSandbox } from '../../extension/src/sandbox';
import '../../extension/src/styles.css';

const root = document.querySelector<HTMLElement>('#sandbox-app');
if (!root) throw new Error('Sandbox root element is missing.');

createSandbox(root);

import '../../extension/src/sidepanel';
