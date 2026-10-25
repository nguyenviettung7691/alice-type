import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const appElement = document.getElementById('app');

if (!appElement) {
  throw new Error('AliceType app mount element was not found.');
}

mount(App, {
  target: appElement
});
