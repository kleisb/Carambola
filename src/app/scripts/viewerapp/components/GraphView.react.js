module React from 'react';
import {Body} from './Body.react.js';

class _GraphView {
    render() {
        return (
            React.DOM.div(null,
                React.DOM.h1(null, "Carambola"),
                Body(null)
            )
        );
    }
}
export const GraphView = React.createClass(_GraphView.prototype);
