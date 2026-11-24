import { createSandbox } from './sandbox';
import './styles.css';

const root = document.querySelector<HTMLElement>('#sandbox-app');
if (!root) throw new Error('Sandbox root element is missing.');

createSandbox(root);
