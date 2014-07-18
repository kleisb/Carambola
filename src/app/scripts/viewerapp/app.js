module React from 'react';
import {GraphView} from './components/GraphView.react.js';

const render = () => React.renderComponent(
    GraphView(null),
    document.getElementById('content')
);

render();