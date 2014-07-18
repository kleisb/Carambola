module React from 'react';

class _Body {
    getClassName() {
        return 'foo';
    }

    render() {
        return (React.DOM.div({className: "graph-view"},
            "Graph view"
        ));
    }

}

export const Body = React.createClass(_Body.prototype);
