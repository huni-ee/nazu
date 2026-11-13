/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './styles/main.css';
import './styles/settings.css';

const app = document.getElementById('app');
if (!app) throw new Error('Dashboard mount element not found.');
mount(App, { target: app });
