(function (exports) {
    'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * True if the custom elements polyfill is in use.
     */
    const isCEPolyfill = typeof window !== 'undefined' &&
        window.customElements != null &&
        window.customElements.polyfillWrapFlushCallback !==
            undefined;
    /**
     * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
     * `container`.
     */
    const removeNodes = (container, start, end = null) => {
        while (start !== end) {
            const n = start.nextSibling;
            container.removeChild(start);
            start = n;
        }
    };

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * An expression marker with embedded unique key to avoid collision with
     * possible text in templates.
     */
    const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
    /**
     * An expression marker used text-positions, multi-binding attributes, and
     * attributes with markup-like text values.
     */
    const nodeMarker = `<!--${marker}-->`;
    const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
    /**
     * Suffix appended to all bound attribute names.
     */
    const boundAttributeSuffix = '$lit$';
    /**
     * An updatable Template that tracks the location of dynamic parts.
     */
    class Template {
        constructor(result, element) {
            this.parts = [];
            this.element = element;
            const nodesToRemove = [];
            const stack = [];
            // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
            const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
            // Keeps track of the last index associated with a part. We try to delete
            // unnecessary nodes, but we never want to associate two different parts
            // to the same index. They must have a constant node between.
            let lastPartIndex = 0;
            let index = -1;
            let partIndex = 0;
            const { strings, values: { length } } = result;
            while (partIndex < length) {
                const node = walker.nextNode();
                if (node === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    continue;
                }
                index++;
                if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                    if (node.hasAttributes()) {
                        const attributes = node.attributes;
                        const { length } = attributes;
                        // Per
                        // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                        // attributes are not guaranteed to be returned in document order.
                        // In particular, Edge/IE can return them out of order, so we cannot
                        // assume a correspondence between part index and attribute index.
                        let count = 0;
                        for (let i = 0; i < length; i++) {
                            if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                                count++;
                            }
                        }
                        while (count-- > 0) {
                            // Get the template literal section leading up to the first
                            // expression in this attribute
                            const stringForPart = strings[partIndex];
                            // Find the attribute name
                            const name = lastAttributeNameRegex.exec(stringForPart)[2];
                            // Find the corresponding attribute
                            // All bound attributes have had a suffix added in
                            // TemplateResult#getHTML to opt out of special attribute
                            // handling. To look up the attribute value we also need to add
                            // the suffix.
                            const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                            const attributeValue = node.getAttribute(attributeLookupName);
                            node.removeAttribute(attributeLookupName);
                            const statics = attributeValue.split(markerRegex);
                            this.parts.push({ type: 'attribute', index, name, strings: statics });
                            partIndex += statics.length - 1;
                        }
                    }
                    if (node.tagName === 'TEMPLATE') {
                        stack.push(node);
                        walker.currentNode = node.content;
                    }
                }
                else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                    const data = node.data;
                    if (data.indexOf(marker) >= 0) {
                        const parent = node.parentNode;
                        const strings = data.split(markerRegex);
                        const lastIndex = strings.length - 1;
                        // Generate a new text node for each literal section
                        // These nodes are also used as the markers for node parts
                        for (let i = 0; i < lastIndex; i++) {
                            let insert;
                            let s = strings[i];
                            if (s === '') {
                                insert = createMarker();
                            }
                            else {
                                const match = lastAttributeNameRegex.exec(s);
                                if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                    s = s.slice(0, match.index) + match[1] +
                                        match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                                }
                                insert = document.createTextNode(s);
                            }
                            parent.insertBefore(insert, node);
                            this.parts.push({ type: 'node', index: ++index });
                        }
                        // If there's no text, we must insert a comment to mark our place.
                        // Else, we can trust it will stick around after cloning.
                        if (strings[lastIndex] === '') {
                            parent.insertBefore(createMarker(), node);
                            nodesToRemove.push(node);
                        }
                        else {
                            node.data = strings[lastIndex];
                        }
                        // We have a part for each match found
                        partIndex += lastIndex;
                    }
                }
                else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                    if (node.data === marker) {
                        const parent = node.parentNode;
                        // Add a new marker node to be the startNode of the Part if any of
                        // the following are true:
                        //  * We don't have a previousSibling
                        //  * The previousSibling is already the start of a previous part
                        if (node.previousSibling === null || index === lastPartIndex) {
                            index++;
                            parent.insertBefore(createMarker(), node);
                        }
                        lastPartIndex = index;
                        this.parts.push({ type: 'node', index });
                        // If we don't have a nextSibling, keep this node so we have an end.
                        // Else, we can remove it to save future costs.
                        if (node.nextSibling === null) {
                            node.data = '';
                        }
                        else {
                            nodesToRemove.push(node);
                            index--;
                        }
                        partIndex++;
                    }
                    else {
                        let i = -1;
                        while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                            // Comment node has a binding marker inside, make an inactive part
                            // The binding won't work, but subsequent bindings will
                            // TODO (justinfagnani): consider whether it's even worth it to
                            // make bindings in comments work
                            this.parts.push({ type: 'node', index: -1 });
                            partIndex++;
                        }
                    }
                }
            }
            // Remove text binding nodes after the walk to not disturb the TreeWalker
            for (const n of nodesToRemove) {
                n.parentNode.removeChild(n);
            }
        }
    }
    const endsWith = (str, suffix) => {
        const index = str.length - suffix.length;
        return index >= 0 && str.slice(index) === suffix;
    };
    const isTemplatePartActive = (part) => part.index !== -1;
    // Allows `document.createComment('')` to be renamed for a
    // small manual size-savings.
    const createMarker = () => document.createComment('');
    /**
     * This regex extracts the attribute name preceding an attribute-position
     * expression. It does this by matching the syntax allowed for attributes
     * against the string literal directly preceding the expression, assuming that
     * the expression is in an attribute-value position.
     *
     * See attributes in the HTML spec:
     * https://www.w3.org/TR/html5/syntax.html#elements-attributes
     *
     * " \x09\x0a\x0c\x0d" are HTML space characters:
     * https://www.w3.org/TR/html5/infrastructure.html#space-characters
     *
     * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
     * space character except " ".
     *
     * So an attribute is:
     *  * The name: any character except a control character, space character, ('),
     *    ("), ">", "=", or "/"
     *  * Followed by zero or more space characters
     *  * Followed by "="
     *  * Followed by zero or more space characters
     *  * Followed by:
     *    * Any character except space, ('), ("), "<", ">", "=", (`), or
     *    * (") then any non-("), or
     *    * (') then any non-(')
     */
    const lastAttributeNameRegex = 
    // eslint-disable-next-line no-control-regex
    /([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    const walkerNodeFilter = 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */;
    /**
     * Removes the list of nodes from a Template safely. In addition to removing
     * nodes from the Template, the Template part indices are updated to match
     * the mutated Template DOM.
     *
     * As the template is walked the removal state is tracked and
     * part indices are adjusted as needed.
     *
     * div
     *   div#1 (remove) <-- start removing (removing node is div#1)
     *     div
     *       div#2 (remove)  <-- continue removing (removing node is still div#1)
     *         div
     * div <-- stop removing since previous sibling is the removing node (div#1,
     * removed 4 nodes)
     */
    function removeNodesFromTemplate(template, nodesToRemove) {
        const { element: { content }, parts } = template;
        const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
        let partIndex = nextActiveIndexInTemplateParts(parts);
        let part = parts[partIndex];
        let nodeIndex = -1;
        let removeCount = 0;
        const nodesToRemoveInTemplate = [];
        let currentRemovingNode = null;
        while (walker.nextNode()) {
            nodeIndex++;
            const node = walker.currentNode;
            // End removal if stepped past the removing node
            if (node.previousSibling === currentRemovingNode) {
                currentRemovingNode = null;
            }
            // A node to remove was found in the template
            if (nodesToRemove.has(node)) {
                nodesToRemoveInTemplate.push(node);
                // Track node we're removing
                if (currentRemovingNode === null) {
                    currentRemovingNode = node;
                }
            }
            // When removing, increment count by which to adjust subsequent part indices
            if (currentRemovingNode !== null) {
                removeCount++;
            }
            while (part !== undefined && part.index === nodeIndex) {
                // If part is in a removed node deactivate it by setting index to -1 or
                // adjust the index as needed.
                part.index = currentRemovingNode !== null ? -1 : part.index - removeCount;
                // go to the next active part.
                partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
                part = parts[partIndex];
            }
        }
        nodesToRemoveInTemplate.forEach((n) => n.parentNode.removeChild(n));
    }
    const countNodes = (node) => {
        let count = (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */) ? 0 : 1;
        const walker = document.createTreeWalker(node, walkerNodeFilter, null, false);
        while (walker.nextNode()) {
            count++;
        }
        return count;
    };
    const nextActiveIndexInTemplateParts = (parts, startIndex = -1) => {
        for (let i = startIndex + 1; i < parts.length; i++) {
            const part = parts[i];
            if (isTemplatePartActive(part)) {
                return i;
            }
        }
        return -1;
    };
    /**
     * Inserts the given node into the Template, optionally before the given
     * refNode. In addition to inserting the node into the Template, the Template
     * part indices are updated to match the mutated Template DOM.
     */
    function insertNodeIntoTemplate(template, node, refNode = null) {
        const { element: { content }, parts } = template;
        // If there's no refNode, then put node at end of template.
        // No part indices need to be shifted in this case.
        if (refNode === null || refNode === undefined) {
            content.appendChild(node);
            return;
        }
        const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
        let partIndex = nextActiveIndexInTemplateParts(parts);
        let insertCount = 0;
        let walkerIndex = -1;
        while (walker.nextNode()) {
            walkerIndex++;
            const walkerNode = walker.currentNode;
            if (walkerNode === refNode) {
                insertCount = countNodes(node);
                refNode.parentNode.insertBefore(node, refNode);
            }
            while (partIndex !== -1 && parts[partIndex].index === walkerIndex) {
                // If we've inserted the node, simply adjust all subsequent parts
                if (insertCount > 0) {
                    while (partIndex !== -1) {
                        parts[partIndex].index += insertCount;
                        partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
                    }
                    return;
                }
                partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
            }
        }
    }

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    const directives = new WeakMap();
    /**
     * Brands a function as a directive factory function so that lit-html will call
     * the function during template rendering, rather than passing as a value.
     *
     * A _directive_ is a function that takes a Part as an argument. It has the
     * signature: `(part: Part) => void`.
     *
     * A directive _factory_ is a function that takes arguments for data and
     * configuration and returns a directive. Users of directive usually refer to
     * the directive factory as the directive. For example, "The repeat directive".
     *
     * Usually a template author will invoke a directive factory in their template
     * with relevant arguments, which will then return a directive function.
     *
     * Here's an example of using the `repeat()` directive factory that takes an
     * array and a function to render an item:
     *
     * ```js
     * html`<ul><${repeat(items, (item) => html`<li>${item}</li>`)}</ul>`
     * ```
     *
     * When `repeat` is invoked, it returns a directive function that closes over
     * `items` and the template function. When the outer template is rendered, the
     * return directive function is called with the Part for the expression.
     * `repeat` then performs it's custom logic to render multiple items.
     *
     * @param f The directive factory function. Must be a function that returns a
     * function of the signature `(part: Part) => void`. The returned function will
     * be called with the part object.
     *
     * @example
     *
     * import {directive, html} from 'lit-html';
     *
     * const immutable = directive((v) => (part) => {
     *   if (part.value !== v) {
     *     part.setValue(v)
     *   }
     * });
     */
    const directive = (f) => ((...args) => {
        const d = f(...args);
        directives.set(d, true);
        return d;
    });
    const isDirective = (o) => {
        return typeof o === 'function' && directives.has(o);
    };

    /**
     * @license
     * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * A sentinel value that signals that a value was handled by a directive and
     * should not be written to the DOM.
     */
    const noChange = {};
    /**
     * A sentinel value that signals a NodePart to fully clear its content.
     */
    const nothing = {};

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * An instance of a `Template` that can be attached to the DOM and updated
     * with new values.
     */
    class TemplateInstance {
        constructor(template, processor, options) {
            this.__parts = [];
            this.template = template;
            this.processor = processor;
            this.options = options;
        }
        update(values) {
            let i = 0;
            for (const part of this.__parts) {
                if (part !== undefined) {
                    part.setValue(values[i]);
                }
                i++;
            }
            for (const part of this.__parts) {
                if (part !== undefined) {
                    part.commit();
                }
            }
        }
        _clone() {
            // There are a number of steps in the lifecycle of a template instance's
            // DOM fragment:
            //  1. Clone - create the instance fragment
            //  2. Adopt - adopt into the main document
            //  3. Process - find part markers and create parts
            //  4. Upgrade - upgrade custom elements
            //  5. Update - set node, attribute, property, etc., values
            //  6. Connect - connect to the document. Optional and outside of this
            //     method.
            //
            // We have a few constraints on the ordering of these steps:
            //  * We need to upgrade before updating, so that property values will pass
            //    through any property setters.
            //  * We would like to process before upgrading so that we're sure that the
            //    cloned fragment is inert and not disturbed by self-modifying DOM.
            //  * We want custom elements to upgrade even in disconnected fragments.
            //
            // Given these constraints, with full custom elements support we would
            // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
            //
            // But Safari does not implement CustomElementRegistry#upgrade, so we
            // can not implement that order and still have upgrade-before-update and
            // upgrade disconnected fragments. So we instead sacrifice the
            // process-before-upgrade constraint, since in Custom Elements v1 elements
            // must not modify their light DOM in the constructor. We still have issues
            // when co-existing with CEv0 elements like Polymer 1, and with polyfills
            // that don't strictly adhere to the no-modification rule because shadow
            // DOM, which may be created in the constructor, is emulated by being placed
            // in the light DOM.
            //
            // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
            // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
            // in one step.
            //
            // The Custom Elements v1 polyfill supports upgrade(), so the order when
            // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
            // Connect.
            const fragment = isCEPolyfill ?
                this.template.element.content.cloneNode(true) :
                document.importNode(this.template.element.content, true);
            const stack = [];
            const parts = this.template.parts;
            // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
            const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
            let partIndex = 0;
            let nodeIndex = 0;
            let part;
            let node = walker.nextNode();
            // Loop through all the nodes and parts of a template
            while (partIndex < parts.length) {
                part = parts[partIndex];
                if (!isTemplatePartActive(part)) {
                    this.__parts.push(undefined);
                    partIndex++;
                    continue;
                }
                // Progress the tree walker until we find our next part's node.
                // Note that multiple parts may share the same node (attribute parts
                // on a single element), so this loop may not run at all.
                while (nodeIndex < part.index) {
                    nodeIndex++;
                    if (node.nodeName === 'TEMPLATE') {
                        stack.push(node);
                        walker.currentNode = node.content;
                    }
                    if ((node = walker.nextNode()) === null) {
                        // We've exhausted the content inside a nested template element.
                        // Because we still have parts (the outer for-loop), we know:
                        // - There is a template in the stack
                        // - The walker will find a nextNode outside the template
                        walker.currentNode = stack.pop();
                        node = walker.nextNode();
                    }
                }
                // We've arrived at our part's node.
                if (part.type === 'node') {
                    const part = this.processor.handleTextExpression(this.options);
                    part.insertAfterNode(node.previousSibling);
                    this.__parts.push(part);
                }
                else {
                    this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
                }
                partIndex++;
            }
            if (isCEPolyfill) {
                document.adoptNode(fragment);
                customElements.upgrade(fragment);
            }
            return fragment;
        }
    }

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * Our TrustedTypePolicy for HTML which is declared using the html template
     * tag function.
     *
     * That HTML is a developer-authored constant, and is parsed with innerHTML
     * before any untrusted expressions have been mixed in. Therefor it is
     * considered safe by construction.
     */
    const policy = window.trustedTypes &&
        trustedTypes.createPolicy('lit-html', { createHTML: (s) => s });
    const commentMarker = ` ${marker} `;
    /**
     * The return type of `html`, which holds a Template and the values from
     * interpolated expressions.
     */
    class TemplateResult {
        constructor(strings, values, type, processor) {
            this.strings = strings;
            this.values = values;
            this.type = type;
            this.processor = processor;
        }
        /**
         * Returns a string of HTML used to create a `<template>` element.
         */
        getHTML() {
            const l = this.strings.length - 1;
            let html = '';
            let isCommentBinding = false;
            for (let i = 0; i < l; i++) {
                const s = this.strings[i];
                // For each binding we want to determine the kind of marker to insert
                // into the template source before it's parsed by the browser's HTML
                // parser. The marker type is based on whether the expression is in an
                // attribute, text, or comment position.
                //   * For node-position bindings we insert a comment with the marker
                //     sentinel as its text content, like <!--{{lit-guid}}-->.
                //   * For attribute bindings we insert just the marker sentinel for the
                //     first binding, so that we support unquoted attribute bindings.
                //     Subsequent bindings can use a comment marker because multi-binding
                //     attributes must be quoted.
                //   * For comment bindings we insert just the marker sentinel so we don't
                //     close the comment.
                //
                // The following code scans the template source, but is *not* an HTML
                // parser. We don't need to track the tree structure of the HTML, only
                // whether a binding is inside a comment, and if not, if it appears to be
                // the first binding in an attribute.
                const commentOpen = s.lastIndexOf('<!--');
                // We're in comment position if we have a comment open with no following
                // comment close. Because <-- can appear in an attribute value there can
                // be false positives.
                isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                    s.indexOf('-->', commentOpen + 1) === -1;
                // Check to see if we have an attribute-like sequence preceding the
                // expression. This can match "name=value" like structures in text,
                // comments, and attribute values, so there can be false-positives.
                const attributeMatch = lastAttributeNameRegex.exec(s);
                if (attributeMatch === null) {
                    // We're only in this branch if we don't have a attribute-like
                    // preceding sequence. For comments, this guards against unusual
                    // attribute values like <div foo="<!--${'bar'}">. Cases like
                    // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                    // below.
                    html += s + (isCommentBinding ? commentMarker : nodeMarker);
                }
                else {
                    // For attributes we use just a marker sentinel, and also append a
                    // $lit$ suffix to the name to opt-out of attribute-specific parsing
                    // that IE and Edge do for style and certain SVG attributes.
                    html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                        attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                        marker;
                }
            }
            html += this.strings[l];
            return html;
        }
        getTemplateElement() {
            const template = document.createElement('template');
            let value = this.getHTML();
            if (policy !== undefined) {
                // this is secure because `this.strings` is a TemplateStringsArray.
                // TODO: validate this when
                // https://github.com/tc39/proposal-array-is-template-object is
                // implemented.
                value = policy.createHTML(value);
            }
            template.innerHTML = value;
            return template;
        }
    }

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    const isPrimitive = (value) => {
        return (value === null ||
            !(typeof value === 'object' || typeof value === 'function'));
    };
    const isIterable = (value) => {
        return Array.isArray(value) ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            !!(value && value[Symbol.iterator]);
    };
    /**
     * Writes attribute values to the DOM for a group of AttributeParts bound to a
     * single attribute. The value is only set once even if there are multiple parts
     * for an attribute.
     */
    class AttributeCommitter {
        constructor(element, name, strings) {
            this.dirty = true;
            this.element = element;
            this.name = name;
            this.strings = strings;
            this.parts = [];
            for (let i = 0; i < strings.length - 1; i++) {
                this.parts[i] = this._createPart();
            }
        }
        /**
         * Creates a single part. Override this to create a differnt type of part.
         */
        _createPart() {
            return new AttributePart(this);
        }
        _getValue() {
            const strings = this.strings;
            const l = strings.length - 1;
            const parts = this.parts;
            // If we're assigning an attribute via syntax like:
            //    attr="${foo}"  or  attr=${foo}
            // but not
            //    attr="${foo} ${bar}" or attr="${foo} baz"
            // then we don't want to coerce the attribute value into one long
            // string. Instead we want to just return the value itself directly,
            // so that sanitizeDOMValue can get the actual value rather than
            // String(value)
            // The exception is if v is an array, in which case we do want to smash
            // it together into a string without calling String() on the array.
            //
            // This also allows trusted values (when using TrustedTypes) being
            // assigned to DOM sinks without being stringified in the process.
            if (l === 1 && strings[0] === '' && strings[1] === '') {
                const v = parts[0].value;
                if (typeof v === 'symbol') {
                    return String(v);
                }
                if (typeof v === 'string' || !isIterable(v)) {
                    return v;
                }
            }
            let text = '';
            for (let i = 0; i < l; i++) {
                text += strings[i];
                const part = parts[i];
                if (part !== undefined) {
                    const v = part.value;
                    if (isPrimitive(v) || !isIterable(v)) {
                        text += typeof v === 'string' ? v : String(v);
                    }
                    else {
                        for (const t of v) {
                            text += typeof t === 'string' ? t : String(t);
                        }
                    }
                }
            }
            text += strings[l];
            return text;
        }
        commit() {
            if (this.dirty) {
                this.dirty = false;
                this.element.setAttribute(this.name, this._getValue());
            }
        }
    }
    /**
     * A Part that controls all or part of an attribute value.
     */
    class AttributePart {
        constructor(committer) {
            this.value = undefined;
            this.committer = committer;
        }
        setValue(value) {
            if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
                this.value = value;
                // If the value is a not a directive, dirty the committer so that it'll
                // call setAttribute. If the value is a directive, it'll dirty the
                // committer if it calls setValue().
                if (!isDirective(value)) {
                    this.committer.dirty = true;
                }
            }
        }
        commit() {
            while (isDirective(this.value)) {
                const directive = this.value;
                this.value = noChange;
                directive(this);
            }
            if (this.value === noChange) {
                return;
            }
            this.committer.commit();
        }
    }
    /**
     * A Part that controls a location within a Node tree. Like a Range, NodePart
     * has start and end locations and can set and update the Nodes between those
     * locations.
     *
     * NodeParts support several value types: primitives, Nodes, TemplateResults,
     * as well as arrays and iterables of those types.
     */
    class NodePart {
        constructor(options) {
            this.value = undefined;
            this.__pendingValue = undefined;
            this.options = options;
        }
        /**
         * Appends this part into a container.
         *
         * This part must be empty, as its contents are not automatically moved.
         */
        appendInto(container) {
            this.startNode = container.appendChild(createMarker());
            this.endNode = container.appendChild(createMarker());
        }
        /**
         * Inserts this part after the `ref` node (between `ref` and `ref`'s next
         * sibling). Both `ref` and its next sibling must be static, unchanging nodes
         * such as those that appear in a literal section of a template.
         *
         * This part must be empty, as its contents are not automatically moved.
         */
        insertAfterNode(ref) {
            this.startNode = ref;
            this.endNode = ref.nextSibling;
        }
        /**
         * Appends this part into a parent part.
         *
         * This part must be empty, as its contents are not automatically moved.
         */
        appendIntoPart(part) {
            part.__insert(this.startNode = createMarker());
            part.__insert(this.endNode = createMarker());
        }
        /**
         * Inserts this part after the `ref` part.
         *
         * This part must be empty, as its contents are not automatically moved.
         */
        insertAfterPart(ref) {
            ref.__insert(this.startNode = createMarker());
            this.endNode = ref.endNode;
            ref.endNode = this.startNode;
        }
        setValue(value) {
            this.__pendingValue = value;
        }
        commit() {
            if (this.startNode.parentNode === null) {
                return;
            }
            while (isDirective(this.__pendingValue)) {
                const directive = this.__pendingValue;
                this.__pendingValue = noChange;
                directive(this);
            }
            const value = this.__pendingValue;
            if (value === noChange) {
                return;
            }
            if (isPrimitive(value)) {
                if (value !== this.value) {
                    this.__commitText(value);
                }
            }
            else if (value instanceof TemplateResult) {
                this.__commitTemplateResult(value);
            }
            else if (value instanceof Node) {
                this.__commitNode(value);
            }
            else if (isIterable(value)) {
                this.__commitIterable(value);
            }
            else if (value === nothing) {
                this.value = nothing;
                this.clear();
            }
            else {
                // Fallback, will render the string representation
                this.__commitText(value);
            }
        }
        __insert(node) {
            this.endNode.parentNode.insertBefore(node, this.endNode);
        }
        __commitNode(value) {
            if (this.value === value) {
                return;
            }
            this.clear();
            this.__insert(value);
            this.value = value;
        }
        __commitText(value) {
            const node = this.startNode.nextSibling;
            value = value == null ? '' : value;
            // If `value` isn't already a string, we explicitly convert it here in case
            // it can't be implicitly converted - i.e. it's a symbol.
            const valueAsString = typeof value === 'string' ? value : String(value);
            if (node === this.endNode.previousSibling &&
                node.nodeType === 3 /* Node.TEXT_NODE */) {
                // If we only have a single text node between the markers, we can just
                // set its value, rather than replacing it.
                // TODO(justinfagnani): Can we just check if this.value is primitive?
                node.data = valueAsString;
            }
            else {
                this.__commitNode(document.createTextNode(valueAsString));
            }
            this.value = value;
        }
        __commitTemplateResult(value) {
            const template = this.options.templateFactory(value);
            if (this.value instanceof TemplateInstance &&
                this.value.template === template) {
                this.value.update(value.values);
            }
            else {
                // Make sure we propagate the template processor from the TemplateResult
                // so that we use its syntax extension, etc. The template factory comes
                // from the render function options so that it can control template
                // caching and preprocessing.
                const instance = new TemplateInstance(template, value.processor, this.options);
                const fragment = instance._clone();
                instance.update(value.values);
                this.__commitNode(fragment);
                this.value = instance;
            }
        }
        __commitIterable(value) {
            // For an Iterable, we create a new InstancePart per item, then set its
            // value to the item. This is a little bit of overhead for every item in
            // an Iterable, but it lets us recurse easily and efficiently update Arrays
            // of TemplateResults that will be commonly returned from expressions like:
            // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
            // If _value is an array, then the previous render was of an
            // iterable and _value will contain the NodeParts from the previous
            // render. If _value is not an array, clear this part and make a new
            // array for NodeParts.
            if (!Array.isArray(this.value)) {
                this.value = [];
                this.clear();
            }
            // Lets us keep track of how many items we stamped so we can clear leftover
            // items from a previous render
            const itemParts = this.value;
            let partIndex = 0;
            let itemPart;
            for (const item of value) {
                // Try to reuse an existing part
                itemPart = itemParts[partIndex];
                // If no existing part, create a new one
                if (itemPart === undefined) {
                    itemPart = new NodePart(this.options);
                    itemParts.push(itemPart);
                    if (partIndex === 0) {
                        itemPart.appendIntoPart(this);
                    }
                    else {
                        itemPart.insertAfterPart(itemParts[partIndex - 1]);
                    }
                }
                itemPart.setValue(item);
                itemPart.commit();
                partIndex++;
            }
            if (partIndex < itemParts.length) {
                // Truncate the parts array so _value reflects the current state
                itemParts.length = partIndex;
                this.clear(itemPart && itemPart.endNode);
            }
        }
        clear(startNode = this.startNode) {
            removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
        }
    }
    /**
     * Implements a boolean attribute, roughly as defined in the HTML
     * specification.
     *
     * If the value is truthy, then the attribute is present with a value of
     * ''. If the value is falsey, the attribute is removed.
     */
    class BooleanAttributePart {
        constructor(element, name, strings) {
            this.value = undefined;
            this.__pendingValue = undefined;
            if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
                throw new Error('Boolean attributes can only contain a single expression');
            }
            this.element = element;
            this.name = name;
            this.strings = strings;
        }
        setValue(value) {
            this.__pendingValue = value;
        }
        commit() {
            while (isDirective(this.__pendingValue)) {
                const directive = this.__pendingValue;
                this.__pendingValue = noChange;
                directive(this);
            }
            if (this.__pendingValue === noChange) {
                return;
            }
            const value = !!this.__pendingValue;
            if (this.value !== value) {
                if (value) {
                    this.element.setAttribute(this.name, '');
                }
                else {
                    this.element.removeAttribute(this.name);
                }
                this.value = value;
            }
            this.__pendingValue = noChange;
        }
    }
    /**
     * Sets attribute values for PropertyParts, so that the value is only set once
     * even if there are multiple parts for a property.
     *
     * If an expression controls the whole property value, then the value is simply
     * assigned to the property under control. If there are string literals or
     * multiple expressions, then the strings are expressions are interpolated into
     * a string first.
     */
    class PropertyCommitter extends AttributeCommitter {
        constructor(element, name, strings) {
            super(element, name, strings);
            this.single =
                (strings.length === 2 && strings[0] === '' && strings[1] === '');
        }
        _createPart() {
            return new PropertyPart(this);
        }
        _getValue() {
            if (this.single) {
                return this.parts[0].value;
            }
            return super._getValue();
        }
        commit() {
            if (this.dirty) {
                this.dirty = false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.element[this.name] = this._getValue();
            }
        }
    }
    class PropertyPart extends AttributePart {
    }
    // Detect event listener options support. If the `capture` property is read
    // from the options object, then options are supported. If not, then the third
    // argument to add/removeEventListener is interpreted as the boolean capture
    // value so we should only pass the `capture` property.
    let eventOptionsSupported = false;
    // Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
    // blocks right into the body of a module
    (() => {
        try {
            const options = {
                get capture() {
                    eventOptionsSupported = true;
                    return false;
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.addEventListener('test', options, options);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.removeEventListener('test', options, options);
        }
        catch (_e) {
            // event options not supported
        }
    })();
    class EventPart {
        constructor(element, eventName, eventContext) {
            this.value = undefined;
            this.__pendingValue = undefined;
            this.element = element;
            this.eventName = eventName;
            this.eventContext = eventContext;
            this.__boundHandleEvent = (e) => this.handleEvent(e);
        }
        setValue(value) {
            this.__pendingValue = value;
        }
        commit() {
            while (isDirective(this.__pendingValue)) {
                const directive = this.__pendingValue;
                this.__pendingValue = noChange;
                directive(this);
            }
            if (this.__pendingValue === noChange) {
                return;
            }
            const newListener = this.__pendingValue;
            const oldListener = this.value;
            const shouldRemoveListener = newListener == null ||
                oldListener != null &&
                    (newListener.capture !== oldListener.capture ||
                        newListener.once !== oldListener.once ||
                        newListener.passive !== oldListener.passive);
            const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
            if (shouldRemoveListener) {
                this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
            }
            if (shouldAddListener) {
                this.__options = getOptions(newListener);
                this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
            }
            this.value = newListener;
            this.__pendingValue = noChange;
        }
        handleEvent(event) {
            if (typeof this.value === 'function') {
                this.value.call(this.eventContext || this.element, event);
            }
            else {
                this.value.handleEvent(event);
            }
        }
    }
    // We copy options because of the inconsistent behavior of browsers when reading
    // the third argument of add/removeEventListener. IE11 doesn't support options
    // at all. Chrome 41 only reads `capture` if the argument is an object.
    const getOptions = (o) => o &&
        (eventOptionsSupported ?
            { capture: o.capture, passive: o.passive, once: o.once } :
            o.capture);

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * The default TemplateFactory which caches Templates keyed on
     * result.type and result.strings.
     */
    function templateFactory(result) {
        let templateCache = templateCaches.get(result.type);
        if (templateCache === undefined) {
            templateCache = {
                stringsArray: new WeakMap(),
                keyString: new Map()
            };
            templateCaches.set(result.type, templateCache);
        }
        let template = templateCache.stringsArray.get(result.strings);
        if (template !== undefined) {
            return template;
        }
        // If the TemplateStringsArray is new, generate a key from the strings
        // This key is shared between all templates with identical content
        const key = result.strings.join(marker);
        // Check if we already have a Template for this key
        template = templateCache.keyString.get(key);
        if (template === undefined) {
            // If we have not seen this key before, create a new Template
            template = new Template(result, result.getTemplateElement());
            // Cache the Template for this key
            templateCache.keyString.set(key, template);
        }
        // Cache all future queries for this TemplateStringsArray
        templateCache.stringsArray.set(result.strings, template);
        return template;
    }
    const templateCaches = new Map();

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    const parts = new WeakMap();
    /**
     * Renders a template result or other value to a container.
     *
     * To update a container with new values, reevaluate the template literal and
     * call `render` with the new result.
     *
     * @param result Any value renderable by NodePart - typically a TemplateResult
     *     created by evaluating a template tag like `html` or `svg`.
     * @param container A DOM parent to render to. The entire contents are either
     *     replaced, or efficiently updated if the same result type was previous
     *     rendered there.
     * @param options RenderOptions for the entire render tree rendered to this
     *     container. Render options must *not* change between renders to the same
     *     container, as those changes will not effect previously rendered DOM.
     */
    const render = (result, container, options) => {
        let part = parts.get(container);
        if (part === undefined) {
            removeNodes(container, container.firstChild);
            parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
            part.appendInto(container);
        }
        part.setValue(result);
        part.commit();
    };

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * Creates Parts when a template is instantiated.
     */
    class DefaultTemplateProcessor {
        /**
         * Create parts for an attribute-position binding, given the event, attribute
         * name, and string literals.
         *
         * @param element The element containing the binding
         * @param name  The attribute name
         * @param strings The string literals. There are always at least two strings,
         *   event for fully-controlled bindings with a single expression.
         */
        handleAttributeExpressions(element, name, strings, options) {
            const prefix = name[0];
            if (prefix === '.') {
                const committer = new PropertyCommitter(element, name.slice(1), strings);
                return committer.parts;
            }
            if (prefix === '@') {
                return [new EventPart(element, name.slice(1), options.eventContext)];
            }
            if (prefix === '?') {
                return [new BooleanAttributePart(element, name.slice(1), strings)];
            }
            const committer = new AttributeCommitter(element, name, strings);
            return committer.parts;
        }
        /**
         * Create parts for a text-position binding.
         * @param templateFactory
         */
        handleTextExpression(options) {
            return new NodePart(options);
        }
    }
    const defaultTemplateProcessor = new DefaultTemplateProcessor();

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    // IMPORTANT: do not change the property name or the assignment expression.
    // This line will be used in regexes to search for lit-html usage.
    // TODO(justinfagnani): inject version number at build time
    if (typeof window !== 'undefined') {
        (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.3.0');
    }
    /**
     * Interprets a template literal as an HTML template that can efficiently
     * render to and update a container.
     */
    const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    // Get a key to lookup in `templateCaches`.
    const getTemplateCacheKey = (type, scopeName) => `${type}--${scopeName}`;
    let compatibleShadyCSSVersion = true;
    if (typeof window.ShadyCSS === 'undefined') {
        compatibleShadyCSSVersion = false;
    }
    else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
        console.warn(`Incompatible ShadyCSS version detected. ` +
            `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and ` +
            `@webcomponents/shadycss@1.3.1.`);
        compatibleShadyCSSVersion = false;
    }
    /**
     * Template factory which scopes template DOM using ShadyCSS.
     * @param scopeName {string}
     */
    const shadyTemplateFactory = (scopeName) => (result) => {
        const cacheKey = getTemplateCacheKey(result.type, scopeName);
        let templateCache = templateCaches.get(cacheKey);
        if (templateCache === undefined) {
            templateCache = {
                stringsArray: new WeakMap(),
                keyString: new Map()
            };
            templateCaches.set(cacheKey, templateCache);
        }
        let template = templateCache.stringsArray.get(result.strings);
        if (template !== undefined) {
            return template;
        }
        const key = result.strings.join(marker);
        template = templateCache.keyString.get(key);
        if (template === undefined) {
            const element = result.getTemplateElement();
            if (compatibleShadyCSSVersion) {
                window.ShadyCSS.prepareTemplateDom(element, scopeName);
            }
            template = new Template(result, element);
            templateCache.keyString.set(key, template);
        }
        templateCache.stringsArray.set(result.strings, template);
        return template;
    };
    const TEMPLATE_TYPES = ['html', 'svg'];
    /**
     * Removes all style elements from Templates for the given scopeName.
     */
    const removeStylesFromLitTemplates = (scopeName) => {
        TEMPLATE_TYPES.forEach((type) => {
            const templates = templateCaches.get(getTemplateCacheKey(type, scopeName));
            if (templates !== undefined) {
                templates.keyString.forEach((template) => {
                    const { element: { content } } = template;
                    // IE 11 doesn't support the iterable param Set constructor
                    const styles = new Set();
                    Array.from(content.querySelectorAll('style')).forEach((s) => {
                        styles.add(s);
                    });
                    removeNodesFromTemplate(template, styles);
                });
            }
        });
    };
    const shadyRenderSet = new Set();
    /**
     * For the given scope name, ensures that ShadyCSS style scoping is performed.
     * This is done just once per scope name so the fragment and template cannot
     * be modified.
     * (1) extracts styles from the rendered fragment and hands them to ShadyCSS
     * to be scoped and appended to the document
     * (2) removes style elements from all lit-html Templates for this scope name.
     *
     * Note, <style> elements can only be placed into templates for the
     * initial rendering of the scope. If <style> elements are included in templates
     * dynamically rendered to the scope (after the first scope render), they will
     * not be scoped and the <style> will be left in the template and rendered
     * output.
     */
    const prepareTemplateStyles = (scopeName, renderedDOM, template) => {
        shadyRenderSet.add(scopeName);
        // If `renderedDOM` is stamped from a Template, then we need to edit that
        // Template's underlying template element. Otherwise, we create one here
        // to give to ShadyCSS, which still requires one while scoping.
        const templateElement = !!template ? template.element : document.createElement('template');
        // Move styles out of rendered DOM and store.
        const styles = renderedDOM.querySelectorAll('style');
        const { length } = styles;
        // If there are no styles, skip unnecessary work
        if (length === 0) {
            // Ensure prepareTemplateStyles is called to support adding
            // styles via `prepareAdoptedCssText` since that requires that
            // `prepareTemplateStyles` is called.
            //
            // ShadyCSS will only update styles containing @apply in the template
            // given to `prepareTemplateStyles`. If no lit Template was given,
            // ShadyCSS will not be able to update uses of @apply in any relevant
            // template. However, this is not a problem because we only create the
            // template for the purpose of supporting `prepareAdoptedCssText`,
            // which doesn't support @apply at all.
            window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
            return;
        }
        const condensedStyle = document.createElement('style');
        // Collect styles into a single style. This helps us make sure ShadyCSS
        // manipulations will not prevent us from being able to fix up template
        // part indices.
        // NOTE: collecting styles is inefficient for browsers but ShadyCSS
        // currently does this anyway. When it does not, this should be changed.
        for (let i = 0; i < length; i++) {
            const style = styles[i];
            style.parentNode.removeChild(style);
            condensedStyle.textContent += style.textContent;
        }
        // Remove styles from nested templates in this scope.
        removeStylesFromLitTemplates(scopeName);
        // And then put the condensed style into the "root" template passed in as
        // `template`.
        const content = templateElement.content;
        if (!!template) {
            insertNodeIntoTemplate(template, condensedStyle, content.firstChild);
        }
        else {
            content.insertBefore(condensedStyle, content.firstChild);
        }
        // Note, it's important that ShadyCSS gets the template that `lit-html`
        // will actually render so that it can update the style inside when
        // needed (e.g. @apply native Shadow DOM case).
        window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
        const style = content.querySelector('style');
        if (window.ShadyCSS.nativeShadow && style !== null) {
            // When in native Shadow DOM, ensure the style created by ShadyCSS is
            // included in initially rendered output (`renderedDOM`).
            renderedDOM.insertBefore(style.cloneNode(true), renderedDOM.firstChild);
        }
        else if (!!template) {
            // When no style is left in the template, parts will be broken as a
            // result. To fix this, we put back the style node ShadyCSS removed
            // and then tell lit to remove that node from the template.
            // There can be no style in the template in 2 cases (1) when Shady DOM
            // is in use, ShadyCSS removes all styles, (2) when native Shadow DOM
            // is in use ShadyCSS removes the style if it contains no content.
            // NOTE, ShadyCSS creates its own style so we can safely add/remove
            // `condensedStyle` here.
            content.insertBefore(condensedStyle, content.firstChild);
            const removes = new Set();
            removes.add(condensedStyle);
            removeNodesFromTemplate(template, removes);
        }
    };
    /**
     * Extension to the standard `render` method which supports rendering
     * to ShadowRoots when the ShadyDOM (https://github.com/webcomponents/shadydom)
     * and ShadyCSS (https://github.com/webcomponents/shadycss) polyfills are used
     * or when the webcomponentsjs
     * (https://github.com/webcomponents/webcomponentsjs) polyfill is used.
     *
     * Adds a `scopeName` option which is used to scope element DOM and stylesheets
     * when native ShadowDOM is unavailable. The `scopeName` will be added to
     * the class attribute of all rendered DOM. In addition, any style elements will
     * be automatically re-written with this `scopeName` selector and moved out
     * of the rendered DOM and into the document `<head>`.
     *
     * It is common to use this render method in conjunction with a custom element
     * which renders a shadowRoot. When this is done, typically the element's
     * `localName` should be used as the `scopeName`.
     *
     * In addition to DOM scoping, ShadyCSS also supports a basic shim for css
     * custom properties (needed only on older browsers like IE11) and a shim for
     * a deprecated feature called `@apply` that supports applying a set of css
     * custom properties to a given location.
     *
     * Usage considerations:
     *
     * * Part values in `<style>` elements are only applied the first time a given
     * `scopeName` renders. Subsequent changes to parts in style elements will have
     * no effect. Because of this, parts in style elements should only be used for
     * values that will never change, for example parts that set scope-wide theme
     * values or parts which render shared style elements.
     *
     * * Note, due to a limitation of the ShadyDOM polyfill, rendering in a
     * custom element's `constructor` is not supported. Instead rendering should
     * either done asynchronously, for example at microtask timing (for example
     * `Promise.resolve()`), or be deferred until the first time the element's
     * `connectedCallback` runs.
     *
     * Usage considerations when using shimmed custom properties or `@apply`:
     *
     * * Whenever any dynamic changes are made which affect
     * css custom properties, `ShadyCSS.styleElement(element)` must be called
     * to update the element. There are two cases when this is needed:
     * (1) the element is connected to a new parent, (2) a class is added to the
     * element that causes it to match different custom properties.
     * To address the first case when rendering a custom element, `styleElement`
     * should be called in the element's `connectedCallback`.
     *
     * * Shimmed custom properties may only be defined either for an entire
     * shadowRoot (for example, in a `:host` rule) or via a rule that directly
     * matches an element with a shadowRoot. In other words, instead of flowing from
     * parent to child as do native css custom properties, shimmed custom properties
     * flow only from shadowRoots to nested shadowRoots.
     *
     * * When using `@apply` mixing css shorthand property names with
     * non-shorthand names (for example `border` and `border-width`) is not
     * supported.
     */
    const render$1 = (result, container, options) => {
        if (!options || typeof options !== 'object' || !options.scopeName) {
            throw new Error('The `scopeName` option is required.');
        }
        const scopeName = options.scopeName;
        const hasRendered = parts.has(container);
        const needsScoping = compatibleShadyCSSVersion &&
            container.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ &&
            !!container.host;
        // Handle first render to a scope specially...
        const firstScopeRender = needsScoping && !shadyRenderSet.has(scopeName);
        // On first scope render, render into a fragment; this cannot be a single
        // fragment that is reused since nested renders can occur synchronously.
        const renderContainer = firstScopeRender ? document.createDocumentFragment() : container;
        render(result, renderContainer, Object.assign({ templateFactory: shadyTemplateFactory(scopeName) }, options));
        // When performing first scope render,
        // (1) We've rendered into a fragment so that there's a chance to
        // `prepareTemplateStyles` before sub-elements hit the DOM
        // (which might cause them to render based on a common pattern of
        // rendering in a custom element's `connectedCallback`);
        // (2) Scope the template with ShadyCSS one time only for this scope.
        // (3) Render the fragment into the container and make sure the
        // container knows its `part` is the one we just rendered. This ensures
        // DOM will be re-used on subsequent renders.
        if (firstScopeRender) {
            const part = parts.get(renderContainer);
            parts.delete(renderContainer);
            // ShadyCSS might have style sheets (e.g. from `prepareAdoptedCssText`)
            // that should apply to `renderContainer` even if the rendered value is
            // not a TemplateInstance. However, it will only insert scoped styles
            // into the document if `prepareTemplateStyles` has already been called
            // for the given scope name.
            const template = part.value instanceof TemplateInstance ?
                part.value.template :
                undefined;
            prepareTemplateStyles(scopeName, renderContainer, template);
            removeNodes(container, container.firstChild);
            container.appendChild(renderContainer);
            parts.set(container, part);
        }
        // After elements have hit the DOM, update styling if this is the
        // initial render to this container.
        // This is needed whenever dynamic changes are made so it would be
        // safest to do every render; however, this would regress performance
        // so we leave it up to the user to call `ShadyCSS.styleElement`
        // for dynamic changes.
        if (!hasRendered && needsScoping) {
            window.ShadyCSS.styleElement(container.host);
        }
    };

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    var _a;
    /**
     * Use this module if you want to create your own base class extending
     * [[UpdatingElement]].
     * @packageDocumentation
     */
    /*
     * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
     * replaced at compile time by the munged name for object[property]. We cannot
     * alias this function, so we have to use a small shim that has the same
     * behavior when not compiling.
     */
    window.JSCompiler_renameProperty =
        (prop, _obj) => prop;
    const defaultConverter = {
        toAttribute(value, type) {
            switch (type) {
                case Boolean:
                    return value ? '' : null;
                case Object:
                case Array:
                    // if the value is `null` or `undefined` pass this through
                    // to allow removing/no change behavior.
                    return value == null ? value : JSON.stringify(value);
            }
            return value;
        },
        fromAttribute(value, type) {
            switch (type) {
                case Boolean:
                    return value !== null;
                case Number:
                    return value === null ? null : Number(value);
                case Object:
                case Array:
                    return JSON.parse(value);
            }
            return value;
        }
    };
    /**
     * Change function that returns true if `value` is different from `oldValue`.
     * This method is used as the default for a property's `hasChanged` function.
     */
    const notEqual = (value, old) => {
        // This ensures (old==NaN, value==NaN) always returns false
        return old !== value && (old === old || value === value);
    };
    const defaultPropertyDeclaration = {
        attribute: true,
        type: String,
        converter: defaultConverter,
        reflect: false,
        hasChanged: notEqual
    };
    const STATE_HAS_UPDATED = 1;
    const STATE_UPDATE_REQUESTED = 1 << 2;
    const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
    const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
    /**
     * The Closure JS Compiler doesn't currently have good support for static
     * property semantics where "this" is dynamic (e.g.
     * https://github.com/google/closure-compiler/issues/3177 and others) so we use
     * this hack to bypass any rewriting by the compiler.
     */
    const finalized = 'finalized';
    /**
     * Base element class which manages element properties and attributes. When
     * properties change, the `update` method is asynchronously called. This method
     * should be supplied by subclassers to render updates as desired.
     * @noInheritDoc
     */
    class UpdatingElement extends HTMLElement {
        constructor() {
            super();
            this.initialize();
        }
        /**
         * Returns a list of attributes corresponding to the registered properties.
         * @nocollapse
         */
        static get observedAttributes() {
            // note: piggy backing on this to ensure we're finalized.
            this.finalize();
            const attributes = [];
            // Use forEach so this works even if for/of loops are compiled to for loops
            // expecting arrays
            this._classProperties.forEach((v, p) => {
                const attr = this._attributeNameForProperty(p, v);
                if (attr !== undefined) {
                    this._attributeToPropertyMap.set(attr, p);
                    attributes.push(attr);
                }
            });
            return attributes;
        }
        /**
         * Ensures the private `_classProperties` property metadata is created.
         * In addition to `finalize` this is also called in `createProperty` to
         * ensure the `@property` decorator can add property metadata.
         */
        /** @nocollapse */
        static _ensureClassProperties() {
            // ensure private storage for property declarations.
            if (!this.hasOwnProperty(JSCompiler_renameProperty('_classProperties', this))) {
                this._classProperties = new Map();
                // NOTE: Workaround IE11 not supporting Map constructor argument.
                const superProperties = Object.getPrototypeOf(this)._classProperties;
                if (superProperties !== undefined) {
                    superProperties.forEach((v, k) => this._classProperties.set(k, v));
                }
            }
        }
        /**
         * Creates a property accessor on the element prototype if one does not exist
         * and stores a PropertyDeclaration for the property with the given options.
         * The property setter calls the property's `hasChanged` property option
         * or uses a strict identity check to determine whether or not to request
         * an update.
         *
         * This method may be overridden to customize properties; however,
         * when doing so, it's important to call `super.createProperty` to ensure
         * the property is setup correctly. This method calls
         * `getPropertyDescriptor` internally to get a descriptor to install.
         * To customize what properties do when they are get or set, override
         * `getPropertyDescriptor`. To customize the options for a property,
         * implement `createProperty` like this:
         *
         * static createProperty(name, options) {
         *   options = Object.assign(options, {myOption: true});
         *   super.createProperty(name, options);
         * }
         *
         * @nocollapse
         */
        static createProperty(name, options = defaultPropertyDeclaration) {
            // Note, since this can be called by the `@property` decorator which
            // is called before `finalize`, we ensure storage exists for property
            // metadata.
            this._ensureClassProperties();
            this._classProperties.set(name, options);
            // Do not generate an accessor if the prototype already has one, since
            // it would be lost otherwise and that would never be the user's intention;
            // Instead, we expect users to call `requestUpdate` themselves from
            // user-defined accessors. Note that if the super has an accessor we will
            // still overwrite it
            if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
                return;
            }
            const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
            const descriptor = this.getPropertyDescriptor(name, key, options);
            if (descriptor !== undefined) {
                Object.defineProperty(this.prototype, name, descriptor);
            }
        }
        /**
         * Returns a property descriptor to be defined on the given named property.
         * If no descriptor is returned, the property will not become an accessor.
         * For example,
         *
         *   class MyElement extends LitElement {
         *     static getPropertyDescriptor(name, key, options) {
         *       const defaultDescriptor =
         *           super.getPropertyDescriptor(name, key, options);
         *       const setter = defaultDescriptor.set;
         *       return {
         *         get: defaultDescriptor.get,
         *         set(value) {
         *           setter.call(this, value);
         *           // custom action.
         *         },
         *         configurable: true,
         *         enumerable: true
         *       }
         *     }
         *   }
         *
         * @nocollapse
         */
        static getPropertyDescriptor(name, key, options) {
            return {
                // tslint:disable-next-line:no-any no symbol in index
                get() {
                    return this[key];
                },
                set(value) {
                    const oldValue = this[name];
                    this[key] = value;
                    this
                        .requestUpdateInternal(name, oldValue, options);
                },
                configurable: true,
                enumerable: true
            };
        }
        /**
         * Returns the property options associated with the given property.
         * These options are defined with a PropertyDeclaration via the `properties`
         * object or the `@property` decorator and are registered in
         * `createProperty(...)`.
         *
         * Note, this method should be considered "final" and not overridden. To
         * customize the options for a given property, override `createProperty`.
         *
         * @nocollapse
         * @final
         */
        static getPropertyOptions(name) {
            return this._classProperties && this._classProperties.get(name) ||
                defaultPropertyDeclaration;
        }
        /**
         * Creates property accessors for registered properties and ensures
         * any superclasses are also finalized.
         * @nocollapse
         */
        static finalize() {
            // finalize any superclasses
            const superCtor = Object.getPrototypeOf(this);
            if (!superCtor.hasOwnProperty(finalized)) {
                superCtor.finalize();
            }
            this[finalized] = true;
            this._ensureClassProperties();
            // initialize Map populated in observedAttributes
            this._attributeToPropertyMap = new Map();
            // make any properties
            // Note, only process "own" properties since this element will inherit
            // any properties defined on the superClass, and finalization ensures
            // the entire prototype chain is finalized.
            if (this.hasOwnProperty(JSCompiler_renameProperty('properties', this))) {
                const props = this.properties;
                // support symbols in properties (IE11 does not support this)
                const propKeys = [
                    ...Object.getOwnPropertyNames(props),
                    ...(typeof Object.getOwnPropertySymbols === 'function') ?
                        Object.getOwnPropertySymbols(props) :
                        []
                ];
                // This for/of is ok because propKeys is an array
                for (const p of propKeys) {
                    // note, use of `any` is due to TypeSript lack of support for symbol in
                    // index types
                    // tslint:disable-next-line:no-any no symbol in index
                    this.createProperty(p, props[p]);
                }
            }
        }
        /**
         * Returns the property name for the given attribute `name`.
         * @nocollapse
         */
        static _attributeNameForProperty(name, options) {
            const attribute = options.attribute;
            return attribute === false ?
                undefined :
                (typeof attribute === 'string' ?
                    attribute :
                    (typeof name === 'string' ? name.toLowerCase() : undefined));
        }
        /**
         * Returns true if a property should request an update.
         * Called when a property value is set and uses the `hasChanged`
         * option for the property if present or a strict identity check.
         * @nocollapse
         */
        static _valueHasChanged(value, old, hasChanged = notEqual) {
            return hasChanged(value, old);
        }
        /**
         * Returns the property value for the given attribute value.
         * Called via the `attributeChangedCallback` and uses the property's
         * `converter` or `converter.fromAttribute` property option.
         * @nocollapse
         */
        static _propertyValueFromAttribute(value, options) {
            const type = options.type;
            const converter = options.converter || defaultConverter;
            const fromAttribute = (typeof converter === 'function' ? converter : converter.fromAttribute);
            return fromAttribute ? fromAttribute(value, type) : value;
        }
        /**
         * Returns the attribute value for the given property value. If this
         * returns undefined, the property will *not* be reflected to an attribute.
         * If this returns null, the attribute will be removed, otherwise the
         * attribute will be set to the value.
         * This uses the property's `reflect` and `type.toAttribute` property options.
         * @nocollapse
         */
        static _propertyValueToAttribute(value, options) {
            if (options.reflect === undefined) {
                return;
            }
            const type = options.type;
            const converter = options.converter;
            const toAttribute = converter && converter.toAttribute ||
                defaultConverter.toAttribute;
            return toAttribute(value, type);
        }
        /**
         * Performs element initialization. By default captures any pre-set values for
         * registered properties.
         */
        initialize() {
            this._updateState = 0;
            this._updatePromise =
                new Promise((res) => this._enableUpdatingResolver = res);
            this._changedProperties = new Map();
            this._saveInstanceProperties();
            // ensures first update will be caught by an early access of
            // `updateComplete`
            this.requestUpdateInternal();
        }
        /**
         * Fixes any properties set on the instance before upgrade time.
         * Otherwise these would shadow the accessor and break these properties.
         * The properties are stored in a Map which is played back after the
         * constructor runs. Note, on very old versions of Safari (<=9) or Chrome
         * (<=41), properties created for native platform properties like (`id` or
         * `name`) may not have default values set in the element constructor. On
         * these browsers native properties appear on instances and therefore their
         * default value will overwrite any element default (e.g. if the element sets
         * this.id = 'id' in the constructor, the 'id' will become '' since this is
         * the native platform default).
         */
        _saveInstanceProperties() {
            // Use forEach so this works even if for/of loops are compiled to for loops
            // expecting arrays
            this.constructor
                ._classProperties.forEach((_v, p) => {
                if (this.hasOwnProperty(p)) {
                    const value = this[p];
                    delete this[p];
                    if (!this._instanceProperties) {
                        this._instanceProperties = new Map();
                    }
                    this._instanceProperties.set(p, value);
                }
            });
        }
        /**
         * Applies previously saved instance properties.
         */
        _applyInstanceProperties() {
            // Use forEach so this works even if for/of loops are compiled to for loops
            // expecting arrays
            // tslint:disable-next-line:no-any
            this._instanceProperties.forEach((v, p) => this[p] = v);
            this._instanceProperties = undefined;
        }
        connectedCallback() {
            // Ensure first connection completes an update. Updates cannot complete
            // before connection.
            this.enableUpdating();
        }
        enableUpdating() {
            if (this._enableUpdatingResolver !== undefined) {
                this._enableUpdatingResolver();
                this._enableUpdatingResolver = undefined;
            }
        }
        /**
         * Allows for `super.disconnectedCallback()` in extensions while
         * reserving the possibility of making non-breaking feature additions
         * when disconnecting at some point in the future.
         */
        disconnectedCallback() {
        }
        /**
         * Synchronizes property values when attributes change.
         */
        attributeChangedCallback(name, old, value) {
            if (old !== value) {
                this._attributeToProperty(name, value);
            }
        }
        _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
            const ctor = this.constructor;
            const attr = ctor._attributeNameForProperty(name, options);
            if (attr !== undefined) {
                const attrValue = ctor._propertyValueToAttribute(value, options);
                // an undefined value does not change the attribute.
                if (attrValue === undefined) {
                    return;
                }
                // Track if the property is being reflected to avoid
                // setting the property again via `attributeChangedCallback`. Note:
                // 1. this takes advantage of the fact that the callback is synchronous.
                // 2. will behave incorrectly if multiple attributes are in the reaction
                // stack at time of calling. However, since we process attributes
                // in `update` this should not be possible (or an extreme corner case
                // that we'd like to discover).
                // mark state reflecting
                this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
                if (attrValue == null) {
                    this.removeAttribute(attr);
                }
                else {
                    this.setAttribute(attr, attrValue);
                }
                // mark state not reflecting
                this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
            }
        }
        _attributeToProperty(name, value) {
            // Use tracking info to avoid deserializing attribute value if it was
            // just set from a property setter.
            if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
                return;
            }
            const ctor = this.constructor;
            // Note, hint this as an `AttributeMap` so closure clearly understands
            // the type; it has issues with tracking types through statics
            // tslint:disable-next-line:no-unnecessary-type-assertion
            const propName = ctor._attributeToPropertyMap.get(name);
            if (propName !== undefined) {
                const options = ctor.getPropertyOptions(propName);
                // mark state reflecting
                this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
                this[propName] =
                    // tslint:disable-next-line:no-any
                    ctor._propertyValueFromAttribute(value, options);
                // mark state not reflecting
                this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
            }
        }
        /**
         * This protected version of `requestUpdate` does not access or return the
         * `updateComplete` promise. This promise can be overridden and is therefore
         * not free to access.
         */
        requestUpdateInternal(name, oldValue, options) {
            let shouldRequestUpdate = true;
            // If we have a property key, perform property update steps.
            if (name !== undefined) {
                const ctor = this.constructor;
                options = options || ctor.getPropertyOptions(name);
                if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                    if (!this._changedProperties.has(name)) {
                        this._changedProperties.set(name, oldValue);
                    }
                    // Add to reflecting properties set.
                    // Note, it's important that every change has a chance to add the
                    // property to `_reflectingProperties`. This ensures setting
                    // attribute + property reflects correctly.
                    if (options.reflect === true &&
                        !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                        if (this._reflectingProperties === undefined) {
                            this._reflectingProperties = new Map();
                        }
                        this._reflectingProperties.set(name, options);
                    }
                }
                else {
                    // Abort the request if the property should not be considered changed.
                    shouldRequestUpdate = false;
                }
            }
            if (!this._hasRequestedUpdate && shouldRequestUpdate) {
                this._updatePromise = this._enqueueUpdate();
            }
        }
        /**
         * Requests an update which is processed asynchronously. This should
         * be called when an element should update based on some state not triggered
         * by setting a property. In this case, pass no arguments. It should also be
         * called when manually implementing a property setter. In this case, pass the
         * property `name` and `oldValue` to ensure that any configured property
         * options are honored. Returns the `updateComplete` Promise which is resolved
         * when the update completes.
         *
         * @param name {PropertyKey} (optional) name of requesting property
         * @param oldValue {any} (optional) old value of requesting property
         * @returns {Promise} A Promise that is resolved when the update completes.
         */
        requestUpdate(name, oldValue) {
            this.requestUpdateInternal(name, oldValue);
            return this.updateComplete;
        }
        /**
         * Sets up the element to asynchronously update.
         */
        async _enqueueUpdate() {
            this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
            try {
                // Ensure any previous update has resolved before updating.
                // This `await` also ensures that property changes are batched.
                await this._updatePromise;
            }
            catch (e) {
                // Ignore any previous errors. We only care that the previous cycle is
                // done. Any error should have been handled in the previous update.
            }
            const result = this.performUpdate();
            // If `performUpdate` returns a Promise, we await it. This is done to
            // enable coordinating updates with a scheduler. Note, the result is
            // checked to avoid delaying an additional microtask unless we need to.
            if (result != null) {
                await result;
            }
            return !this._hasRequestedUpdate;
        }
        get _hasRequestedUpdate() {
            return (this._updateState & STATE_UPDATE_REQUESTED);
        }
        get hasUpdated() {
            return (this._updateState & STATE_HAS_UPDATED);
        }
        /**
         * Performs an element update. Note, if an exception is thrown during the
         * update, `firstUpdated` and `updated` will not be called.
         *
         * You can override this method to change the timing of updates. If this
         * method is overridden, `super.performUpdate()` must be called.
         *
         * For instance, to schedule updates to occur just before the next frame:
         *
         * ```
         * protected async performUpdate(): Promise<unknown> {
         *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
         *   super.performUpdate();
         * }
         * ```
         */
        performUpdate() {
            // Abort any update if one is not pending when this is called.
            // This can happen if `performUpdate` is called early to "flush"
            // the update.
            if (!this._hasRequestedUpdate) {
                return;
            }
            // Mixin instance properties once, if they exist.
            if (this._instanceProperties) {
                this._applyInstanceProperties();
            }
            let shouldUpdate = false;
            const changedProperties = this._changedProperties;
            try {
                shouldUpdate = this.shouldUpdate(changedProperties);
                if (shouldUpdate) {
                    this.update(changedProperties);
                }
                else {
                    this._markUpdated();
                }
            }
            catch (e) {
                // Prevent `firstUpdated` and `updated` from running when there's an
                // update exception.
                shouldUpdate = false;
                // Ensure element can accept additional updates after an exception.
                this._markUpdated();
                throw e;
            }
            if (shouldUpdate) {
                if (!(this._updateState & STATE_HAS_UPDATED)) {
                    this._updateState = this._updateState | STATE_HAS_UPDATED;
                    this.firstUpdated(changedProperties);
                }
                this.updated(changedProperties);
            }
        }
        _markUpdated() {
            this._changedProperties = new Map();
            this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
        }
        /**
         * Returns a Promise that resolves when the element has completed updating.
         * The Promise value is a boolean that is `true` if the element completed the
         * update without triggering another update. The Promise result is `false` if
         * a property was set inside `updated()`. If the Promise is rejected, an
         * exception was thrown during the update.
         *
         * To await additional asynchronous work, override the `_getUpdateComplete`
         * method. For example, it is sometimes useful to await a rendered element
         * before fulfilling this Promise. To do this, first await
         * `super._getUpdateComplete()`, then any subsequent state.
         *
         * @returns {Promise} The Promise returns a boolean that indicates if the
         * update resolved without triggering another update.
         */
        get updateComplete() {
            return this._getUpdateComplete();
        }
        /**
         * Override point for the `updateComplete` promise.
         *
         * It is not safe to override the `updateComplete` getter directly due to a
         * limitation in TypeScript which means it is not possible to call a
         * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
         * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
         * This method should be overridden instead. For example:
         *
         *   class MyElement extends LitElement {
         *     async _getUpdateComplete() {
         *       await super._getUpdateComplete();
         *       await this._myChild.updateComplete;
         *     }
         *   }
         */
        _getUpdateComplete() {
            return this._updatePromise;
        }
        /**
         * Controls whether or not `update` should be called when the element requests
         * an update. By default, this method always returns `true`, but this can be
         * customized to control when to update.
         *
         * @param _changedProperties Map of changed properties with old values
         */
        shouldUpdate(_changedProperties) {
            return true;
        }
        /**
         * Updates the element. This method reflects property values to attributes.
         * It can be overridden to render and keep updated element DOM.
         * Setting properties inside this method will *not* trigger
         * another update.
         *
         * @param _changedProperties Map of changed properties with old values
         */
        update(_changedProperties) {
            if (this._reflectingProperties !== undefined &&
                this._reflectingProperties.size > 0) {
                // Use forEach so this works even if for/of loops are compiled to for
                // loops expecting arrays
                this._reflectingProperties.forEach((v, k) => this._propertyToAttribute(k, this[k], v));
                this._reflectingProperties = undefined;
            }
            this._markUpdated();
        }
        /**
         * Invoked whenever the element is updated. Implement to perform
         * post-updating tasks via DOM APIs, for example, focusing an element.
         *
         * Setting properties inside this method will trigger the element to update
         * again after this update cycle completes.
         *
         * @param _changedProperties Map of changed properties with old values
         */
        updated(_changedProperties) {
        }
        /**
         * Invoked when the element is first updated. Implement to perform one time
         * work on the element after update.
         *
         * Setting properties inside this method will trigger the element to update
         * again after this update cycle completes.
         *
         * @param _changedProperties Map of changed properties with old values
         */
        firstUpdated(_changedProperties) {
        }
    }
    _a = finalized;
    /**
     * Marks class as having finished creating properties.
     */
    UpdatingElement[_a] = true;

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    const legacyCustomElement = (tagName, clazz) => {
        window.customElements.define(tagName, clazz);
        // Cast as any because TS doesn't recognize the return type as being a
        // subtype of the decorated class when clazz is typed as
        // `Constructor<HTMLElement>` for some reason.
        // `Constructor<HTMLElement>` is helpful to make sure the decorator is
        // applied to elements however.
        // tslint:disable-next-line:no-any
        return clazz;
    };
    const standardCustomElement = (tagName, descriptor) => {
        const { kind, elements } = descriptor;
        return {
            kind,
            elements,
            // This callback is called once the class is otherwise fully defined
            finisher(clazz) {
                window.customElements.define(tagName, clazz);
            }
        };
    };
    /**
     * Class decorator factory that defines the decorated class as a custom element.
     *
     * ```
     * @customElement('my-element')
     * class MyElement {
     *   render() {
     *     return html``;
     *   }
     * }
     * ```
     * @category Decorator
     * @param tagName The name of the custom element to define.
     */
    const customElement = (tagName) => (classOrDescriptor) => (typeof classOrDescriptor === 'function') ?
        legacyCustomElement(tagName, classOrDescriptor) :
        standardCustomElement(tagName, classOrDescriptor);
    const standardProperty = (options, element) => {
        // When decorating an accessor, pass it through and add property metadata.
        // Note, the `hasOwnProperty` check in `createProperty` ensures we don't
        // stomp over the user's accessor.
        if (element.kind === 'method' && element.descriptor &&
            !('value' in element.descriptor)) {
            return Object.assign(Object.assign({}, element), { finisher(clazz) {
                    clazz.createProperty(element.key, options);
                } });
        }
        else {
            // createProperty() takes care of defining the property, but we still
            // must return some kind of descriptor, so return a descriptor for an
            // unused prototype field. The finisher calls createProperty().
            return {
                kind: 'field',
                key: Symbol(),
                placement: 'own',
                descriptor: {},
                // When @babel/plugin-proposal-decorators implements initializers,
                // do this instead of the initializer below. See:
                // https://github.com/babel/babel/issues/9260 extras: [
                //   {
                //     kind: 'initializer',
                //     placement: 'own',
                //     initializer: descriptor.initializer,
                //   }
                // ],
                initializer() {
                    if (typeof element.initializer === 'function') {
                        this[element.key] = element.initializer.call(this);
                    }
                },
                finisher(clazz) {
                    clazz.createProperty(element.key, options);
                }
            };
        }
    };
    const legacyProperty = (options, proto, name) => {
        proto.constructor
            .createProperty(name, options);
    };
    /**
     * A property decorator which creates a LitElement property which reflects a
     * corresponding attribute value. A [[`PropertyDeclaration`]] may optionally be
     * supplied to configure property features.
     *
     * This decorator should only be used for public fields. Private or protected
     * fields should use the [[`internalProperty`]] decorator.
     *
     * @example
     * ```ts
     * class MyElement {
     *   @property({ type: Boolean })
     *   clicked = false;
     * }
     * ```
     * @category Decorator
     * @ExportDecoratedItems
     */
    function property(options) {
        // tslint:disable-next-line:no-any decorator
        return (protoOrDescriptor, name) => (name !== undefined) ?
            legacyProperty(options, protoOrDescriptor, name) :
            standardProperty(options, protoOrDescriptor);
    }
    /**
     * Declares a private or protected property that still triggers updates to the
     * element when it changes.
     *
     * Properties declared this way must not be used from HTML or HTML templating
     * systems, they're solely for properties internal to the element. These
     * properties may be renamed by optimization tools like closure compiler.
     * @category Decorator
     */
    function internalProperty(options) {
        return property({ attribute: false, hasChanged: options === null || options === void 0 ? void 0 : options.hasChanged });
    }
    /**
     * A property decorator that converts a class property into a getter that
     * executes a querySelector on the element's renderRoot.
     *
     * @param selector A DOMString containing one or more selectors to match.
     * @param cache An optional boolean which when true performs the DOM query only
     * once and caches the result.
     *
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
     *
     * @example
     *
     * ```ts
     * class MyElement {
     *   @query('#first')
     *   first;
     *
     *   render() {
     *     return html`
     *       <div id="first"></div>
     *       <div id="second"></div>
     *     `;
     *   }
     * }
     * ```
     * @category Decorator
     */
    function query(selector, cache) {
        return (protoOrDescriptor, 
        // tslint:disable-next-line:no-any decorator
        name) => {
            const descriptor = {
                get() {
                    return this.renderRoot.querySelector(selector);
                },
                enumerable: true,
                configurable: true,
            };
            if (cache) {
                const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
                descriptor.get = function () {
                    if (this[key] === undefined) {
                        (this[key] =
                            this.renderRoot.querySelector(selector));
                    }
                    return this[key];
                };
            }
            return (name !== undefined) ?
                legacyQuery(descriptor, protoOrDescriptor, name) :
                standardQuery(descriptor, protoOrDescriptor);
        };
    }
    // Note, in the future, we may extend this decorator to support the use case
    // where the queried element may need to do work to become ready to interact
    // with (e.g. load some implementation code). If so, we might elect to
    // add a second argument defining a function that can be run to make the
    // queried element loaded/updated/ready.
    /**
     * A property decorator that converts a class property into a getter that
     * returns a promise that resolves to the result of a querySelector on the
     * element's renderRoot done after the element's `updateComplete` promise
     * resolves. When the queried property may change with element state, this
     * decorator can be used instead of requiring users to await the
     * `updateComplete` before accessing the property.
     *
     * @param selector A DOMString containing one or more selectors to match.
     *
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
     *
     * @example
     * ```ts
     * class MyElement {
     *   @queryAsync('#first')
     *   first;
     *
     *   render() {
     *     return html`
     *       <div id="first"></div>
     *       <div id="second"></div>
     *     `;
     *   }
     * }
     *
     * // external usage
     * async doSomethingWithFirst() {
     *  (await aMyElement.first).doSomething();
     * }
     * ```
     * @category Decorator
     */
    function queryAsync(selector) {
        return (protoOrDescriptor, 
        // tslint:disable-next-line:no-any decorator
        name) => {
            const descriptor = {
                async get() {
                    await this.updateComplete;
                    return this.renderRoot.querySelector(selector);
                },
                enumerable: true,
                configurable: true,
            };
            return (name !== undefined) ?
                legacyQuery(descriptor, protoOrDescriptor, name) :
                standardQuery(descriptor, protoOrDescriptor);
        };
    }
    const legacyQuery = (descriptor, proto, name) => {
        Object.defineProperty(proto, name, descriptor);
    };
    const standardQuery = (descriptor, element) => ({
        kind: 'method',
        placement: 'prototype',
        key: element.key,
        descriptor,
    });
    const standardEventOptions = (options, element) => {
        return Object.assign(Object.assign({}, element), { finisher(clazz) {
                Object.assign(clazz.prototype[element.key], options);
            } });
    };
    const legacyEventOptions = 
    // tslint:disable-next-line:no-any legacy decorator
    (options, proto, name) => {
        Object.assign(proto[name], options);
    };
    /**
     * Adds event listener options to a method used as an event listener in a
     * lit-html template.
     *
     * @param options An object that specifies event listener options as accepted by
     * `EventTarget#addEventListener` and `EventTarget#removeEventListener`.
     *
     * Current browsers support the `capture`, `passive`, and `once` options. See:
     * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#Parameters
     *
     * @example
     * ```ts
     * class MyElement {
     *   clicked = false;
     *
     *   render() {
     *     return html`
     *       <div @click=${this._onClick}`>
     *         <button></button>
     *       </div>
     *     `;
     *   }
     *
     *   @eventOptions({capture: true})
     *   _onClick(e) {
     *     this.clicked = true;
     *   }
     * }
     * ```
     * @category Decorator
     */
    function eventOptions(options) {
        // Return value typed as any to prevent TypeScript from complaining that
        // standard decorator function signature does not match TypeScript decorator
        // signature
        // TODO(kschaaf): unclear why it was only failing on this decorator and not
        // the others
        return ((protoOrDescriptor, name) => (name !== undefined) ?
            legacyEventOptions(options, protoOrDescriptor, name) :
            standardEventOptions(options, protoOrDescriptor));
    }

    /**
    @license
    Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
    This code may only be used under the BSD style license found at
    http://polymer.github.io/LICENSE.txt The complete set of authors may be found at
    http://polymer.github.io/AUTHORS.txt The complete set of contributors may be
    found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as
    part of the polymer project is also subject to an additional IP rights grant
    found at http://polymer.github.io/PATENTS.txt
    */
    /**
     * Whether the current browser supports `adoptedStyleSheets`.
     */
    const supportsAdoptingStyleSheets = (window.ShadowRoot) &&
        (window.ShadyCSS === undefined || window.ShadyCSS.nativeShadow) &&
        ('adoptedStyleSheets' in Document.prototype) &&
        ('replace' in CSSStyleSheet.prototype);
    const constructionToken = Symbol();
    class CSSResult {
        constructor(cssText, safeToken) {
            if (safeToken !== constructionToken) {
                throw new Error('CSSResult is not constructable. Use `unsafeCSS` or `css` instead.');
            }
            this.cssText = cssText;
        }
        // Note, this is a getter so that it's lazy. In practice, this means
        // stylesheets are not created until the first element instance is made.
        get styleSheet() {
            if (this._styleSheet === undefined) {
                // Note, if `supportsAdoptingStyleSheets` is true then we assume
                // CSSStyleSheet is constructable.
                if (supportsAdoptingStyleSheets) {
                    this._styleSheet = new CSSStyleSheet();
                    this._styleSheet.replaceSync(this.cssText);
                }
                else {
                    this._styleSheet = null;
                }
            }
            return this._styleSheet;
        }
        toString() {
            return this.cssText;
        }
    }
    /**
     * Wrap a value for interpolation in a [[`css`]] tagged template literal.
     *
     * This is unsafe because untrusted CSS text can be used to phone home
     * or exfiltrate data to an attacker controlled site. Take care to only use
     * this with trusted input.
     */
    const unsafeCSS = (value) => {
        return new CSSResult(String(value), constructionToken);
    };
    const textFromCSSResult = (value) => {
        if (value instanceof CSSResult) {
            return value.cssText;
        }
        else if (typeof value === 'number') {
            return value;
        }
        else {
            throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but
            take care to ensure page security.`);
        }
    };
    /**
     * Template tag which which can be used with LitElement's [[LitElement.styles |
     * `styles`]] property to set element styles. For security reasons, only literal
     * string values may be used. To incorporate non-literal values [[`unsafeCSS`]]
     * may be used inside a template string part.
     */
    const css = (strings, ...values) => {
        const cssText = values.reduce((acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
        return new CSSResult(cssText, constructionToken);
    };

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    // IMPORTANT: do not change the property name or the assignment expression.
    // This line will be used in regexes to search for LitElement usage.
    // TODO(justinfagnani): inject version number at build time
    (window['litElementVersions'] || (window['litElementVersions'] = []))
        .push('2.4.0');
    /**
     * Sentinal value used to avoid calling lit-html's render function when
     * subclasses do not implement `render`
     */
    const renderNotImplemented = {};
    /**
     * Base element class that manages element properties and attributes, and
     * renders a lit-html template.
     *
     * To define a component, subclass `LitElement` and implement a
     * `render` method to provide the component's template. Define properties
     * using the [[`properties`]] property or the [[`property`]] decorator.
     */
    class LitElement extends UpdatingElement {
        /**
         * Return the array of styles to apply to the element.
         * Override this method to integrate into a style management system.
         *
         * @nocollapse
         */
        static getStyles() {
            return this.styles;
        }
        /** @nocollapse */
        static _getUniqueStyles() {
            // Only gather styles once per class
            if (this.hasOwnProperty(JSCompiler_renameProperty('_styles', this))) {
                return;
            }
            // Take care not to call `this.getStyles()` multiple times since this
            // generates new CSSResults each time.
            // TODO(sorvell): Since we do not cache CSSResults by input, any
            // shared styles will generate new stylesheet objects, which is wasteful.
            // This should be addressed when a browser ships constructable
            // stylesheets.
            const userStyles = this.getStyles();
            if (Array.isArray(userStyles)) {
                // De-duplicate styles preserving the _last_ instance in the set.
                // This is a performance optimization to avoid duplicated styles that can
                // occur especially when composing via subclassing.
                // The last item is kept to try to preserve the cascade order with the
                // assumption that it's most important that last added styles override
                // previous styles.
                const addStyles = (styles, set) => styles.reduceRight((set, s) => 
                // Note: On IE set.add() does not return the set
                Array.isArray(s) ? addStyles(s, set) : (set.add(s), set), set);
                // Array.from does not work on Set in IE, otherwise return
                // Array.from(addStyles(userStyles, new Set<CSSResult>())).reverse()
                const set = addStyles(userStyles, new Set());
                const styles = [];
                set.forEach((v) => styles.unshift(v));
                this._styles = styles;
            }
            else {
                this._styles = userStyles === undefined ? [] : [userStyles];
            }
            // Ensure that there are no invalid CSSStyleSheet instances here. They are
            // invalid in two conditions.
            // (1) the sheet is non-constructible (`sheet` of a HTMLStyleElement), but
            //     this is impossible to check except via .replaceSync or use
            // (2) the ShadyCSS polyfill is enabled (:. supportsAdoptingStyleSheets is
            //     false)
            this._styles = this._styles.map((s) => {
                if (s instanceof CSSStyleSheet && !supportsAdoptingStyleSheets) {
                    // Flatten the cssText from the passed constructible stylesheet (or
                    // undetectable non-constructible stylesheet). The user might have
                    // expected to update their stylesheets over time, but the alternative
                    // is a crash.
                    const cssText = Array.prototype.slice.call(s.cssRules)
                        .reduce((css, rule) => css + rule.cssText, '');
                    return unsafeCSS(cssText);
                }
                return s;
            });
        }
        /**
         * Performs element initialization. By default this calls
         * [[`createRenderRoot`]] to create the element [[`renderRoot`]] node and
         * captures any pre-set values for registered properties.
         */
        initialize() {
            super.initialize();
            this.constructor._getUniqueStyles();
            this.renderRoot = this.createRenderRoot();
            // Note, if renderRoot is not a shadowRoot, styles would/could apply to the
            // element's getRootNode(). While this could be done, we're choosing not to
            // support this now since it would require different logic around de-duping.
            if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
                this.adoptStyles();
            }
        }
        /**
         * Returns the node into which the element should render and by default
         * creates and returns an open shadowRoot. Implement to customize where the
         * element's DOM is rendered. For example, to render into the element's
         * childNodes, return `this`.
         * @returns {Element|DocumentFragment} Returns a node into which to render.
         */
        createRenderRoot() {
            return this.attachShadow({ mode: 'open' });
        }
        /**
         * Applies styling to the element shadowRoot using the [[`styles`]]
         * property. Styling will apply using `shadowRoot.adoptedStyleSheets` where
         * available and will fallback otherwise. When Shadow DOM is polyfilled,
         * ShadyCSS scopes styles and adds them to the document. When Shadow DOM
         * is available but `adoptedStyleSheets` is not, styles are appended to the
         * end of the `shadowRoot` to [mimic spec
         * behavior](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets).
         */
        adoptStyles() {
            const styles = this.constructor._styles;
            if (styles.length === 0) {
                return;
            }
            // There are three separate cases here based on Shadow DOM support.
            // (1) shadowRoot polyfilled: use ShadyCSS
            // (2) shadowRoot.adoptedStyleSheets available: use it
            // (3) shadowRoot.adoptedStyleSheets polyfilled: append styles after
            // rendering
            if (window.ShadyCSS !== undefined && !window.ShadyCSS.nativeShadow) {
                window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s) => s.cssText), this.localName);
            }
            else if (supportsAdoptingStyleSheets) {
                this.renderRoot.adoptedStyleSheets =
                    styles.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
            }
            else {
                // This must be done after rendering so the actual style insertion is done
                // in `update`.
                this._needsShimAdoptedStyleSheets = true;
            }
        }
        connectedCallback() {
            super.connectedCallback();
            // Note, first update/render handles styleElement so we only call this if
            // connected after first update.
            if (this.hasUpdated && window.ShadyCSS !== undefined) {
                window.ShadyCSS.styleElement(this);
            }
        }
        /**
         * Updates the element. This method reflects property values to attributes
         * and calls `render` to render DOM via lit-html. Setting properties inside
         * this method will *not* trigger another update.
         * @param _changedProperties Map of changed properties with old values
         */
        update(changedProperties) {
            // Setting properties in `render` should not trigger an update. Since
            // updates are allowed after super.update, it's important to call `render`
            // before that.
            const templateResult = this.render();
            super.update(changedProperties);
            // If render is not implemented by the component, don't call lit-html render
            if (templateResult !== renderNotImplemented) {
                this.constructor
                    .render(templateResult, this.renderRoot, { scopeName: this.localName, eventContext: this });
            }
            // When native Shadow DOM is used but adoptedStyles are not supported,
            // insert styling after rendering to ensure adoptedStyles have highest
            // priority.
            if (this._needsShimAdoptedStyleSheets) {
                this._needsShimAdoptedStyleSheets = false;
                this.constructor._styles.forEach((s) => {
                    const style = document.createElement('style');
                    style.textContent = s.cssText;
                    this.renderRoot.appendChild(style);
                });
            }
        }
        /**
         * Invoked on each update to perform rendering tasks. This method may return
         * any value renderable by lit-html's `NodePart` - typically a
         * `TemplateResult`. Setting properties inside this method will *not* trigger
         * the element to update.
         */
        render() {
            return renderNotImplemented;
        }
    }
    /**
     * Ensure this class is marked as `finalized` as an optimization ensuring
     * it will not needlessly try to `finalize`.
     *
     * Note this property name is a string to prevent breaking Closure JS Compiler
     * optimizations. See updating-element.ts for more information.
     */
    LitElement['finalized'] = true;
    /**
     * Reference to the underlying library method used to render the element's
     * DOM. By default, points to the `render` method from lit-html's shady-render
     * module.
     *
     * **Most users will never need to touch this property.**
     *
     * This  property should not be confused with the `render` instance method,
     * which should be overridden to define a template for the element.
     *
     * Advanced users creating a new base class based on LitElement can override
     * this property to point to a custom render method with a signature that
     * matches [shady-render's `render`
     * method](https://lit-html.polymer-project.org/api/modules/shady_render.html#render).
     *
     * @nocollapse
     */
    LitElement.render = render$1;

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style = css `:host{font-family:var(--mdc-icon-font, "Material Icons");font-weight:normal;font-style:normal;font-size:var(--mdc-icon-size, 24px);line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;font-feature-settings:"liga"}`;

    /** @soyCompatible */
    let Icon = class Icon extends LitElement {
        /** @soyTemplate */
        render() {
            return html `<slot></slot>`;
        }
    };
    Icon.styles = style;
    Icon = __decorate([
        customElement('mwc-icon')
    ], Icon);

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    /**
     * @fileoverview A "ponyfill" is a polyfill that doesn't modify the global prototype chain.
     * This makes ponyfills safer than traditional polyfills, especially for libraries like MDC.
     */
    function closest(element, selector) {
        if (element.closest) {
            return element.closest(selector);
        }
        var el = element;
        while (el) {
            if (matches(el, selector)) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }
    function matches(element, selector) {
        var nativeMatches = element.matches
            || element.webkitMatchesSelector
            || element.msMatchesSelector;
        return nativeMatches.call(element, selector);
    }

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    /**
     * Determines whether a node is an element.
     *
     * @param node Node to check
     */
    const isNodeElement = (node) => {
        return node.nodeType === Node.ELEMENT_NODE;
    };
    function findAssignedElement(slot, selector) {
        for (const node of slot.assignedNodes({ flatten: true })) {
            if (isNodeElement(node)) {
                const el = node;
                if (matches(el, selector)) {
                    return el;
                }
            }
        }
        return null;
    }
    function addHasRemoveClass(element) {
        return {
            addClass: (className) => {
                element.classList.add(className);
            },
            removeClass: (className) => {
                element.classList.remove(className);
            },
            hasClass: (className) => element.classList.contains(className),
        };
    }
    const fn = () => { };
    const optionsBlock = {
        get passive() {
            return false;
        }
    };
    document.addEventListener('x', fn, optionsBlock);
    document.removeEventListener('x', fn);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    /** @soyCompatible */
    class BaseElement extends LitElement {
        click() {
            if (this.mdcRoot) {
                this.mdcRoot.focus();
                this.mdcRoot.click();
                return;
            }
            super.click();
        }
        /**
         * Create and attach the MDC Foundation to the instance
         */
        createFoundation() {
            if (this.mdcFoundation !== undefined) {
                this.mdcFoundation.destroy();
            }
            if (this.mdcFoundationClass) {
                this.mdcFoundation = new this.mdcFoundationClass(this.createAdapter());
                this.mdcFoundation.init();
            }
        }
        firstUpdated() {
            this.createFoundation();
        }
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFoundation = /** @class */ (function () {
        function MDCFoundation(adapter) {
            if (adapter === void 0) { adapter = {}; }
            this.adapter = adapter;
        }
        Object.defineProperty(MDCFoundation, "cssClasses", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports every
                // CSS class the foundation class needs as a property. e.g. {ACTIVE: 'mdc-component--active'}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "strings", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // semantic strings as constants. e.g. {ARIA_ROLE: 'tablist'}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "numbers", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // of its semantic numbers as constants. e.g. {ANIMATION_DELAY_MS: 350}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "defaultAdapter", {
            get: function () {
                // Classes extending MDCFoundation may choose to implement this getter in order to provide a convenient
                // way of viewing the necessary methods of an adapter. In the future, this could also be used for adapter
                // validation.
                return {};
            },
            enumerable: true,
            configurable: true
        });
        MDCFoundation.prototype.init = function () {
            // Subclasses should override this method to perform initialization routines (registering events, etc.)
        };
        MDCFoundation.prototype.destroy = function () {
            // Subclasses should override this method to perform de-initialization routines (de-registering events, etc.)
        };
        return MDCFoundation;
    }());

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses = {
        // Ripple is a special case where the "root" component is really a "mixin" of sorts,
        // given that it's an 'upgrade' to an existing component. That being said it is the root
        // CSS class that all other CSS classes derive from.
        BG_FOCUSED: 'mdc-ripple-upgraded--background-focused',
        FG_ACTIVATION: 'mdc-ripple-upgraded--foreground-activation',
        FG_DEACTIVATION: 'mdc-ripple-upgraded--foreground-deactivation',
        ROOT: 'mdc-ripple-upgraded',
        UNBOUNDED: 'mdc-ripple-upgraded--unbounded',
    };
    var strings = {
        VAR_FG_SCALE: '--mdc-ripple-fg-scale',
        VAR_FG_SIZE: '--mdc-ripple-fg-size',
        VAR_FG_TRANSLATE_END: '--mdc-ripple-fg-translate-end',
        VAR_FG_TRANSLATE_START: '--mdc-ripple-fg-translate-start',
        VAR_LEFT: '--mdc-ripple-left',
        VAR_TOP: '--mdc-ripple-top',
    };
    var numbers = {
        DEACTIVATION_TIMEOUT_MS: 225,
        FG_DEACTIVATION_MS: 150,
        INITIAL_ORIGIN_SCALE: 0.6,
        PADDING: 10,
        TAP_DELAY_MS: 300,
    };

    /**
     * Stores result from supportsCssVariables to avoid redundant processing to
     * detect CSS custom variable support.
     */
    function getNormalizedEventCoords(evt, pageOffset, clientRect) {
        if (!evt) {
            return { x: 0, y: 0 };
        }
        var x = pageOffset.x, y = pageOffset.y;
        var documentX = x + clientRect.left;
        var documentY = y + clientRect.top;
        var normalizedX;
        var normalizedY;
        // Determine touch point relative to the ripple container.
        if (evt.type === 'touchstart') {
            var touchEvent = evt;
            normalizedX = touchEvent.changedTouches[0].pageX - documentX;
            normalizedY = touchEvent.changedTouches[0].pageY - documentY;
        }
        else {
            var mouseEvent = evt;
            normalizedX = mouseEvent.pageX - documentX;
            normalizedY = mouseEvent.pageY - documentY;
        }
        return { x: normalizedX, y: normalizedY };
    }

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    // Activation events registered on the root element of each instance for activation
    var ACTIVATION_EVENT_TYPES = [
        'touchstart', 'pointerdown', 'mousedown', 'keydown',
    ];
    // Deactivation events registered on documentElement when a pointer-related down event occurs
    var POINTER_DEACTIVATION_EVENT_TYPES = [
        'touchend', 'pointerup', 'mouseup', 'contextmenu',
    ];
    // simultaneous nested activations
    var activatedTargets = [];
    var MDCRippleFoundation = /** @class */ (function (_super) {
        __extends(MDCRippleFoundation, _super);
        function MDCRippleFoundation(adapter) {
            var _this = _super.call(this, __assign(__assign({}, MDCRippleFoundation.defaultAdapter), adapter)) || this;
            _this.activationAnimationHasEnded_ = false;
            _this.activationTimer_ = 0;
            _this.fgDeactivationRemovalTimer_ = 0;
            _this.fgScale_ = '0';
            _this.frame_ = { width: 0, height: 0 };
            _this.initialSize_ = 0;
            _this.layoutFrame_ = 0;
            _this.maxRadius_ = 0;
            _this.unboundedCoords_ = { left: 0, top: 0 };
            _this.activationState_ = _this.defaultActivationState_();
            _this.activationTimerCallback_ = function () {
                _this.activationAnimationHasEnded_ = true;
                _this.runDeactivationUXLogicIfReady_();
            };
            _this.activateHandler_ = function (e) { return _this.activate_(e); };
            _this.deactivateHandler_ = function () { return _this.deactivate_(); };
            _this.focusHandler_ = function () { return _this.handleFocus(); };
            _this.blurHandler_ = function () { return _this.handleBlur(); };
            _this.resizeHandler_ = function () { return _this.layout(); };
            return _this;
        }
        Object.defineProperty(MDCRippleFoundation, "cssClasses", {
            get: function () {
                return cssClasses;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "strings", {
            get: function () {
                return strings;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "numbers", {
            get: function () {
                return numbers;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "defaultAdapter", {
            get: function () {
                return {
                    addClass: function () { return undefined; },
                    browserSupportsCssVars: function () { return true; },
                    computeBoundingRect: function () { return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 }); },
                    containsEventTarget: function () { return true; },
                    deregisterDocumentInteractionHandler: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                    deregisterResizeHandler: function () { return undefined; },
                    getWindowPageOffset: function () { return ({ x: 0, y: 0 }); },
                    isSurfaceActive: function () { return true; },
                    isSurfaceDisabled: function () { return true; },
                    isUnbounded: function () { return true; },
                    registerDocumentInteractionHandler: function () { return undefined; },
                    registerInteractionHandler: function () { return undefined; },
                    registerResizeHandler: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    updateCssVariable: function () { return undefined; },
                };
            },
            enumerable: true,
            configurable: true
        });
        MDCRippleFoundation.prototype.init = function () {
            var _this = this;
            var supportsPressRipple = this.supportsPressRipple_();
            this.registerRootHandlers_(supportsPressRipple);
            if (supportsPressRipple) {
                var _a = MDCRippleFoundation.cssClasses, ROOT_1 = _a.ROOT, UNBOUNDED_1 = _a.UNBOUNDED;
                requestAnimationFrame(function () {
                    _this.adapter.addClass(ROOT_1);
                    if (_this.adapter.isUnbounded()) {
                        _this.adapter.addClass(UNBOUNDED_1);
                        // Unbounded ripples need layout logic applied immediately to set coordinates for both shade and ripple
                        _this.layoutInternal_();
                    }
                });
            }
        };
        MDCRippleFoundation.prototype.destroy = function () {
            var _this = this;
            if (this.supportsPressRipple_()) {
                if (this.activationTimer_) {
                    clearTimeout(this.activationTimer_);
                    this.activationTimer_ = 0;
                    this.adapter.removeClass(MDCRippleFoundation.cssClasses.FG_ACTIVATION);
                }
                if (this.fgDeactivationRemovalTimer_) {
                    clearTimeout(this.fgDeactivationRemovalTimer_);
                    this.fgDeactivationRemovalTimer_ = 0;
                    this.adapter.removeClass(MDCRippleFoundation.cssClasses.FG_DEACTIVATION);
                }
                var _a = MDCRippleFoundation.cssClasses, ROOT_2 = _a.ROOT, UNBOUNDED_2 = _a.UNBOUNDED;
                requestAnimationFrame(function () {
                    _this.adapter.removeClass(ROOT_2);
                    _this.adapter.removeClass(UNBOUNDED_2);
                    _this.removeCssVars_();
                });
            }
            this.deregisterRootHandlers_();
            this.deregisterDeactivationHandlers_();
        };
        /**
         * @param evt Optional event containing position information.
         */
        MDCRippleFoundation.prototype.activate = function (evt) {
            this.activate_(evt);
        };
        MDCRippleFoundation.prototype.deactivate = function () {
            this.deactivate_();
        };
        MDCRippleFoundation.prototype.layout = function () {
            var _this = this;
            if (this.layoutFrame_) {
                cancelAnimationFrame(this.layoutFrame_);
            }
            this.layoutFrame_ = requestAnimationFrame(function () {
                _this.layoutInternal_();
                _this.layoutFrame_ = 0;
            });
        };
        MDCRippleFoundation.prototype.setUnbounded = function (unbounded) {
            var UNBOUNDED = MDCRippleFoundation.cssClasses.UNBOUNDED;
            if (unbounded) {
                this.adapter.addClass(UNBOUNDED);
            }
            else {
                this.adapter.removeClass(UNBOUNDED);
            }
        };
        MDCRippleFoundation.prototype.handleFocus = function () {
            var _this = this;
            requestAnimationFrame(function () { return _this.adapter.addClass(MDCRippleFoundation.cssClasses.BG_FOCUSED); });
        };
        MDCRippleFoundation.prototype.handleBlur = function () {
            var _this = this;
            requestAnimationFrame(function () { return _this.adapter.removeClass(MDCRippleFoundation.cssClasses.BG_FOCUSED); });
        };
        /**
         * We compute this property so that we are not querying information about the client
         * until the point in time where the foundation requests it. This prevents scenarios where
         * client-side feature-detection may happen too early, such as when components are rendered on the server
         * and then initialized at mount time on the client.
         */
        MDCRippleFoundation.prototype.supportsPressRipple_ = function () {
            return this.adapter.browserSupportsCssVars();
        };
        MDCRippleFoundation.prototype.defaultActivationState_ = function () {
            return {
                activationEvent: undefined,
                hasDeactivationUXRun: false,
                isActivated: false,
                isProgrammatic: false,
                wasActivatedByPointer: false,
                wasElementMadeActive: false,
            };
        };
        /**
         * supportsPressRipple Passed from init to save a redundant function call
         */
        MDCRippleFoundation.prototype.registerRootHandlers_ = function (supportsPressRipple) {
            var _this = this;
            if (supportsPressRipple) {
                ACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                    _this.adapter.registerInteractionHandler(evtType, _this.activateHandler_);
                });
                if (this.adapter.isUnbounded()) {
                    this.adapter.registerResizeHandler(this.resizeHandler_);
                }
            }
            this.adapter.registerInteractionHandler('focus', this.focusHandler_);
            this.adapter.registerInteractionHandler('blur', this.blurHandler_);
        };
        MDCRippleFoundation.prototype.registerDeactivationHandlers_ = function (evt) {
            var _this = this;
            if (evt.type === 'keydown') {
                this.adapter.registerInteractionHandler('keyup', this.deactivateHandler_);
            }
            else {
                POINTER_DEACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                    _this.adapter.registerDocumentInteractionHandler(evtType, _this.deactivateHandler_);
                });
            }
        };
        MDCRippleFoundation.prototype.deregisterRootHandlers_ = function () {
            var _this = this;
            ACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                _this.adapter.deregisterInteractionHandler(evtType, _this.activateHandler_);
            });
            this.adapter.deregisterInteractionHandler('focus', this.focusHandler_);
            this.adapter.deregisterInteractionHandler('blur', this.blurHandler_);
            if (this.adapter.isUnbounded()) {
                this.adapter.deregisterResizeHandler(this.resizeHandler_);
            }
        };
        MDCRippleFoundation.prototype.deregisterDeactivationHandlers_ = function () {
            var _this = this;
            this.adapter.deregisterInteractionHandler('keyup', this.deactivateHandler_);
            POINTER_DEACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                _this.adapter.deregisterDocumentInteractionHandler(evtType, _this.deactivateHandler_);
            });
        };
        MDCRippleFoundation.prototype.removeCssVars_ = function () {
            var _this = this;
            var rippleStrings = MDCRippleFoundation.strings;
            var keys = Object.keys(rippleStrings);
            keys.forEach(function (key) {
                if (key.indexOf('VAR_') === 0) {
                    _this.adapter.updateCssVariable(rippleStrings[key], null);
                }
            });
        };
        MDCRippleFoundation.prototype.activate_ = function (evt) {
            var _this = this;
            if (this.adapter.isSurfaceDisabled()) {
                return;
            }
            var activationState = this.activationState_;
            if (activationState.isActivated) {
                return;
            }
            // Avoid reacting to follow-on events fired by touch device after an already-processed user interaction
            var previousActivationEvent = this.previousActivationEvent_;
            var isSameInteraction = previousActivationEvent && evt !== undefined && previousActivationEvent.type !== evt.type;
            if (isSameInteraction) {
                return;
            }
            activationState.isActivated = true;
            activationState.isProgrammatic = evt === undefined;
            activationState.activationEvent = evt;
            activationState.wasActivatedByPointer = activationState.isProgrammatic ? false : evt !== undefined && (evt.type === 'mousedown' || evt.type === 'touchstart' || evt.type === 'pointerdown');
            var hasActivatedChild = evt !== undefined &&
                activatedTargets.length > 0 &&
                activatedTargets.some(function (target) { return _this.adapter.containsEventTarget(target); });
            if (hasActivatedChild) {
                // Immediately reset activation state, while preserving logic that prevents touch follow-on events
                this.resetActivationState_();
                return;
            }
            if (evt !== undefined) {
                activatedTargets.push(evt.target);
                this.registerDeactivationHandlers_(evt);
            }
            activationState.wasElementMadeActive = this.checkElementMadeActive_(evt);
            if (activationState.wasElementMadeActive) {
                this.animateActivation_();
            }
            requestAnimationFrame(function () {
                // Reset array on next frame after the current event has had a chance to bubble to prevent ancestor ripples
                activatedTargets = [];
                if (!activationState.wasElementMadeActive
                    && evt !== undefined
                    && (evt.key === ' ' || evt.keyCode === 32)) {
                    // If space was pressed, try again within an rAF call to detect :active, because different UAs report
                    // active states inconsistently when they're called within event handling code:
                    // - https://bugs.chromium.org/p/chromium/issues/detail?id=635971
                    // - https://bugzilla.mozilla.org/show_bug.cgi?id=1293741
                    // We try first outside rAF to support Edge, which does not exhibit this problem, but will crash if a CSS
                    // variable is set within a rAF callback for a submit button interaction (#2241).
                    activationState.wasElementMadeActive = _this.checkElementMadeActive_(evt);
                    if (activationState.wasElementMadeActive) {
                        _this.animateActivation_();
                    }
                }
                if (!activationState.wasElementMadeActive) {
                    // Reset activation state immediately if element was not made active.
                    _this.activationState_ = _this.defaultActivationState_();
                }
            });
        };
        MDCRippleFoundation.prototype.checkElementMadeActive_ = function (evt) {
            return (evt !== undefined && evt.type === 'keydown') ?
                this.adapter.isSurfaceActive() :
                true;
        };
        MDCRippleFoundation.prototype.animateActivation_ = function () {
            var _this = this;
            var _a = MDCRippleFoundation.strings, VAR_FG_TRANSLATE_START = _a.VAR_FG_TRANSLATE_START, VAR_FG_TRANSLATE_END = _a.VAR_FG_TRANSLATE_END;
            var _b = MDCRippleFoundation.cssClasses, FG_DEACTIVATION = _b.FG_DEACTIVATION, FG_ACTIVATION = _b.FG_ACTIVATION;
            var DEACTIVATION_TIMEOUT_MS = MDCRippleFoundation.numbers.DEACTIVATION_TIMEOUT_MS;
            this.layoutInternal_();
            var translateStart = '';
            var translateEnd = '';
            if (!this.adapter.isUnbounded()) {
                var _c = this.getFgTranslationCoordinates_(), startPoint = _c.startPoint, endPoint = _c.endPoint;
                translateStart = startPoint.x + "px, " + startPoint.y + "px";
                translateEnd = endPoint.x + "px, " + endPoint.y + "px";
            }
            this.adapter.updateCssVariable(VAR_FG_TRANSLATE_START, translateStart);
            this.adapter.updateCssVariable(VAR_FG_TRANSLATE_END, translateEnd);
            // Cancel any ongoing activation/deactivation animations
            clearTimeout(this.activationTimer_);
            clearTimeout(this.fgDeactivationRemovalTimer_);
            this.rmBoundedActivationClasses_();
            this.adapter.removeClass(FG_DEACTIVATION);
            // Force layout in order to re-trigger the animation.
            this.adapter.computeBoundingRect();
            this.adapter.addClass(FG_ACTIVATION);
            this.activationTimer_ = setTimeout(function () { return _this.activationTimerCallback_(); }, DEACTIVATION_TIMEOUT_MS);
        };
        MDCRippleFoundation.prototype.getFgTranslationCoordinates_ = function () {
            var _a = this.activationState_, activationEvent = _a.activationEvent, wasActivatedByPointer = _a.wasActivatedByPointer;
            var startPoint;
            if (wasActivatedByPointer) {
                startPoint = getNormalizedEventCoords(activationEvent, this.adapter.getWindowPageOffset(), this.adapter.computeBoundingRect());
            }
            else {
                startPoint = {
                    x: this.frame_.width / 2,
                    y: this.frame_.height / 2,
                };
            }
            // Center the element around the start point.
            startPoint = {
                x: startPoint.x - (this.initialSize_ / 2),
                y: startPoint.y - (this.initialSize_ / 2),
            };
            var endPoint = {
                x: (this.frame_.width / 2) - (this.initialSize_ / 2),
                y: (this.frame_.height / 2) - (this.initialSize_ / 2),
            };
            return { startPoint: startPoint, endPoint: endPoint };
        };
        MDCRippleFoundation.prototype.runDeactivationUXLogicIfReady_ = function () {
            var _this = this;
            // This method is called both when a pointing device is released, and when the activation animation ends.
            // The deactivation animation should only run after both of those occur.
            var FG_DEACTIVATION = MDCRippleFoundation.cssClasses.FG_DEACTIVATION;
            var _a = this.activationState_, hasDeactivationUXRun = _a.hasDeactivationUXRun, isActivated = _a.isActivated;
            var activationHasEnded = hasDeactivationUXRun || !isActivated;
            if (activationHasEnded && this.activationAnimationHasEnded_) {
                this.rmBoundedActivationClasses_();
                this.adapter.addClass(FG_DEACTIVATION);
                this.fgDeactivationRemovalTimer_ = setTimeout(function () {
                    _this.adapter.removeClass(FG_DEACTIVATION);
                }, numbers.FG_DEACTIVATION_MS);
            }
        };
        MDCRippleFoundation.prototype.rmBoundedActivationClasses_ = function () {
            var FG_ACTIVATION = MDCRippleFoundation.cssClasses.FG_ACTIVATION;
            this.adapter.removeClass(FG_ACTIVATION);
            this.activationAnimationHasEnded_ = false;
            this.adapter.computeBoundingRect();
        };
        MDCRippleFoundation.prototype.resetActivationState_ = function () {
            var _this = this;
            this.previousActivationEvent_ = this.activationState_.activationEvent;
            this.activationState_ = this.defaultActivationState_();
            // Touch devices may fire additional events for the same interaction within a short time.
            // Store the previous event until it's safe to assume that subsequent events are for new interactions.
            setTimeout(function () { return _this.previousActivationEvent_ = undefined; }, MDCRippleFoundation.numbers.TAP_DELAY_MS);
        };
        MDCRippleFoundation.prototype.deactivate_ = function () {
            var _this = this;
            var activationState = this.activationState_;
            // This can happen in scenarios such as when you have a keyup event that blurs the element.
            if (!activationState.isActivated) {
                return;
            }
            var state = __assign({}, activationState);
            if (activationState.isProgrammatic) {
                requestAnimationFrame(function () { return _this.animateDeactivation_(state); });
                this.resetActivationState_();
            }
            else {
                this.deregisterDeactivationHandlers_();
                requestAnimationFrame(function () {
                    _this.activationState_.hasDeactivationUXRun = true;
                    _this.animateDeactivation_(state);
                    _this.resetActivationState_();
                });
            }
        };
        MDCRippleFoundation.prototype.animateDeactivation_ = function (_a) {
            var wasActivatedByPointer = _a.wasActivatedByPointer, wasElementMadeActive = _a.wasElementMadeActive;
            if (wasActivatedByPointer || wasElementMadeActive) {
                this.runDeactivationUXLogicIfReady_();
            }
        };
        MDCRippleFoundation.prototype.layoutInternal_ = function () {
            var _this = this;
            this.frame_ = this.adapter.computeBoundingRect();
            var maxDim = Math.max(this.frame_.height, this.frame_.width);
            // Surface diameter is treated differently for unbounded vs. bounded ripples.
            // Unbounded ripple diameter is calculated smaller since the surface is expected to already be padded appropriately
            // to extend the hitbox, and the ripple is expected to meet the edges of the padded hitbox (which is typically
            // square). Bounded ripples, on the other hand, are fully expected to expand beyond the surface's longest diameter
            // (calculated based on the diagonal plus a constant padding), and are clipped at the surface's border via
            // `overflow: hidden`.
            var getBoundedRadius = function () {
                var hypotenuse = Math.sqrt(Math.pow(_this.frame_.width, 2) + Math.pow(_this.frame_.height, 2));
                return hypotenuse + MDCRippleFoundation.numbers.PADDING;
            };
            this.maxRadius_ = this.adapter.isUnbounded() ? maxDim : getBoundedRadius();
            // Ripple is sized as a fraction of the largest dimension of the surface, then scales up using a CSS scale transform
            var initialSize = Math.floor(maxDim * MDCRippleFoundation.numbers.INITIAL_ORIGIN_SCALE);
            // Unbounded ripple size should always be even number to equally center align.
            if (this.adapter.isUnbounded() && initialSize % 2 !== 0) {
                this.initialSize_ = initialSize - 1;
            }
            else {
                this.initialSize_ = initialSize;
            }
            this.fgScale_ = "" + this.maxRadius_ / this.initialSize_;
            this.updateLayoutCssVars_();
        };
        MDCRippleFoundation.prototype.updateLayoutCssVars_ = function () {
            var _a = MDCRippleFoundation.strings, VAR_FG_SIZE = _a.VAR_FG_SIZE, VAR_LEFT = _a.VAR_LEFT, VAR_TOP = _a.VAR_TOP, VAR_FG_SCALE = _a.VAR_FG_SCALE;
            this.adapter.updateCssVariable(VAR_FG_SIZE, this.initialSize_ + "px");
            this.adapter.updateCssVariable(VAR_FG_SCALE, this.fgScale_);
            if (this.adapter.isUnbounded()) {
                this.unboundedCoords_ = {
                    left: Math.round((this.frame_.width / 2) - (this.initialSize_ / 2)),
                    top: Math.round((this.frame_.height / 2) - (this.initialSize_ / 2)),
                };
                this.adapter.updateCssVariable(VAR_LEFT, this.unboundedCoords_.left + "px");
                this.adapter.updateCssVariable(VAR_TOP, this.unboundedCoords_.top + "px");
            }
        };
        return MDCRippleFoundation;
    }(MDCFoundation));

    /**
     * @license
     * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    // IE11 doesn't support classList on SVG elements, so we emulate it with a Set
    class ClassList {
        constructor(element) {
            this.classes = new Set();
            this.changed = false;
            this.element = element;
            const classList = (element.getAttribute('class') || '').split(/\s+/);
            for (const cls of classList) {
                this.classes.add(cls);
            }
        }
        add(cls) {
            this.classes.add(cls);
            this.changed = true;
        }
        remove(cls) {
            this.classes.delete(cls);
            this.changed = true;
        }
        commit() {
            if (this.changed) {
                let classString = '';
                this.classes.forEach((cls) => classString += cls + ' ');
                this.element.setAttribute('class', classString);
            }
        }
    }
    /**
     * Stores the ClassInfo object applied to a given AttributePart.
     * Used to unset existing values when a new ClassInfo object is applied.
     */
    const previousClassesCache = new WeakMap();
    /**
     * A directive that applies CSS classes. This must be used in the `class`
     * attribute and must be the only part used in the attribute. It takes each
     * property in the `classInfo` argument and adds the property name to the
     * element's `class` if the property value is truthy; if the property value is
     * falsey, the property name is removed from the element's `class`. For example
     * `{foo: bar}` applies the class `foo` if the value of `bar` is truthy.
     * @param classInfo {ClassInfo}
     */
    const classMap = directive((classInfo) => (part) => {
        if (!(part instanceof AttributePart) || (part instanceof PropertyPart) ||
            part.committer.name !== 'class' || part.committer.parts.length > 1) {
            throw new Error('The `classMap` directive must be used in the `class` attribute ' +
                'and must be the only part in the attribute.');
        }
        const { committer } = part;
        const { element } = committer;
        let previousClasses = previousClassesCache.get(part);
        if (previousClasses === undefined) {
            // Write static classes once
            // Use setAttribute() because className isn't a string on SVG elements
            element.setAttribute('class', committer.strings.join(' '));
            previousClassesCache.set(part, previousClasses = new Set());
        }
        const classList = (element.classList || new ClassList(element));
        // Remove old classes that no longer apply
        // We use forEach() instead of for-of so that re don't require down-level
        // iteration.
        previousClasses.forEach((name) => {
            if (!(name in classInfo)) {
                classList.remove(name);
                previousClasses.delete(name);
            }
        });
        // Add or remove classes based on their classMap value
        for (const name in classInfo) {
            const value = classInfo[name];
            if (value != previousClasses.has(name)) {
                // We explicitly want a loose truthy check of `value` because it seems
                // more convenient that '' and 0 are skipped.
                if (value) {
                    classList.add(name);
                    previousClasses.add(name);
                }
                else {
                    classList.remove(name);
                    previousClasses.delete(name);
                }
            }
        }
        if (typeof classList.commit === 'function') {
            classList.commit();
        }
    });

    /**
     * @license
     * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    /**
     * Stores the StyleInfo object applied to a given AttributePart.
     * Used to unset existing values when a new StyleInfo object is applied.
     */
    const previousStylePropertyCache = new WeakMap();
    /**
     * A directive that applies CSS properties to an element.
     *
     * `styleMap` can only be used in the `style` attribute and must be the only
     * expression in the attribute. It takes the property names in the `styleInfo`
     * object and adds the property values as CSS properties. Property names with
     * dashes (`-`) are assumed to be valid CSS property names and set on the
     * element's style object using `setProperty()`. Names without dashes are
     * assumed to be camelCased JavaScript property names and set on the element's
     * style object using property assignment, allowing the style object to
     * translate JavaScript-style names to CSS property names.
     *
     * For example `styleMap({backgroundColor: 'red', 'border-top': '5px', '--size':
     * '0'})` sets the `background-color`, `border-top` and `--size` properties.
     *
     * @param styleInfo {StyleInfo}
     */
    const styleMap = directive((styleInfo) => (part) => {
        if (!(part instanceof AttributePart) || (part instanceof PropertyPart) ||
            part.committer.name !== 'style' || part.committer.parts.length > 1) {
            throw new Error('The `styleMap` directive must be used in the style attribute ' +
                'and must be the only part in the attribute.');
        }
        const { committer } = part;
        const { style } = committer.element;
        let previousStyleProperties = previousStylePropertyCache.get(part);
        if (previousStyleProperties === undefined) {
            // Write static styles once
            style.cssText = committer.strings.join(' ');
            previousStylePropertyCache.set(part, previousStyleProperties = new Set());
        }
        // Remove old properties that no longer exist in styleInfo
        // We use forEach() instead of for-of so that re don't require down-level
        // iteration.
        previousStyleProperties.forEach((name) => {
            if (!(name in styleInfo)) {
                previousStyleProperties.delete(name);
                if (name.indexOf('-') === -1) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    style[name] = null;
                }
                else {
                    style.removeProperty(name);
                }
            }
        });
        // Add or update properties
        for (const name in styleInfo) {
            previousStyleProperties.add(name);
            if (name.indexOf('-') === -1) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                style[name] = styleInfo[name];
            }
            else {
                style.setProperty(name, styleInfo[name]);
            }
        }
    });

    /** @soyCompatible */
    class RippleBase extends BaseElement {
        constructor() {
            super(...arguments);
            this.primary = false;
            this.accent = false;
            this.unbounded = false;
            this.disabled = false;
            this.activated = false;
            this.selected = false;
            this.hovering = false;
            this.bgFocused = false;
            this.fgActivation = false;
            this.fgDeactivation = false;
            this.fgScale = '';
            this.fgSize = '';
            this.translateStart = '';
            this.translateEnd = '';
            this.leftPos = '';
            this.topPos = '';
            this.mdcFoundationClass = MDCRippleFoundation;
        }
        get isActive() {
            return (this.parentElement || this).matches(':active');
        }
        createAdapter() {
            return {
                browserSupportsCssVars: () => true,
                isUnbounded: () => this.unbounded,
                isSurfaceActive: () => this.isActive,
                isSurfaceDisabled: () => this.disabled,
                addClass: (className) => {
                    switch (className) {
                        case 'mdc-ripple-upgraded--background-focused':
                            this.bgFocused = true;
                            break;
                        case 'mdc-ripple-upgraded--foreground-activation':
                            this.fgActivation = true;
                            break;
                        case 'mdc-ripple-upgraded--foreground-deactivation':
                            this.fgDeactivation = true;
                            break;
                    }
                },
                removeClass: (className) => {
                    switch (className) {
                        case 'mdc-ripple-upgraded--background-focused':
                            this.bgFocused = false;
                            break;
                        case 'mdc-ripple-upgraded--foreground-activation':
                            this.fgActivation = false;
                            break;
                        case 'mdc-ripple-upgraded--foreground-deactivation':
                            this.fgDeactivation = false;
                            break;
                    }
                },
                containsEventTarget: () => true,
                registerInteractionHandler: () => undefined,
                deregisterInteractionHandler: () => undefined,
                registerDocumentInteractionHandler: () => undefined,
                deregisterDocumentInteractionHandler: () => undefined,
                registerResizeHandler: () => undefined,
                deregisterResizeHandler: () => undefined,
                updateCssVariable: (varName, value) => {
                    switch (varName) {
                        case '--mdc-ripple-fg-scale':
                            this.fgScale = value;
                            break;
                        case '--mdc-ripple-fg-size':
                            this.fgSize = value;
                            break;
                        case '--mdc-ripple-fg-translate-end':
                            this.translateEnd = value;
                            break;
                        case '--mdc-ripple-fg-translate-start':
                            this.translateStart = value;
                            break;
                        case '--mdc-ripple-left':
                            this.leftPos = value;
                            break;
                        case '--mdc-ripple-top':
                            this.topPos = value;
                            break;
                    }
                },
                computeBoundingRect: () => (this.parentElement || this).getBoundingClientRect(),
                getWindowPageOffset: () => ({ x: window.pageXOffset, y: window.pageYOffset }),
            };
        }
        startPress(ev) {
            this.waitForFoundation(() => {
                this.mdcFoundation.activate(ev);
            });
        }
        endPress() {
            this.waitForFoundation(() => {
                this.mdcFoundation.deactivate();
            });
        }
        startFocus() {
            this.waitForFoundation(() => {
                this.mdcFoundation.handleFocus();
            });
        }
        endFocus() {
            this.waitForFoundation(() => {
                this.mdcFoundation.handleBlur();
            });
        }
        startHover() {
            this.hovering = true;
        }
        endHover() {
            this.hovering = false;
        }
        /**
         * Wait for the MDCFoundation to be created by `firstUpdated`
         */
        waitForFoundation(fn) {
            if (this.mdcFoundation) {
                fn();
            }
            else {
                this.updateComplete.then(fn);
            }
        }
        /** @soyTemplate */
        render() {
            const shouldActivateInPrimary = this.activated && (this.primary || !this.accent);
            const shouldSelectInPrimary = this.selected && (this.primary || !this.accent);
            /** @classMap */
            const classes = {
                'mdc-ripple-surface--accent': this.accent,
                'mdc-ripple-surface--primary--activated': shouldActivateInPrimary,
                'mdc-ripple-surface--accent--activated': this.accent && this.activated,
                'mdc-ripple-surface--primary--selected': shouldSelectInPrimary,
                'mdc-ripple-surface--accent--selected': this.accent && this.selected,
                'mdc-ripple-surface--disabled': this.disabled,
                'mdc-ripple-surface--hover': this.hovering,
                'mdc-ripple-surface--primary': this.primary,
                'mdc-ripple-surface--selected': this.selected,
                'mdc-ripple-upgraded--background-focused': this.bgFocused,
                'mdc-ripple-upgraded--foreground-activation': this.fgActivation,
                'mdc-ripple-upgraded--foreground-deactivation': this.fgDeactivation,
                'mdc-ripple-upgraded--unbounded': this.unbounded,
            };
            return html `
        <div class="mdc-ripple-surface mdc-ripple-upgraded ${classMap(classes)}"
          style="${styleMap({
            '--mdc-ripple-fg-scale': this.fgScale,
            '--mdc-ripple-fg-size': this.fgSize,
            '--mdc-ripple-fg-translate-end': this.translateEnd,
            '--mdc-ripple-fg-translate-start': this.translateStart,
            '--mdc-ripple-left': this.leftPos,
            '--mdc-ripple-top': this.topPos,
        })}"></div>`;
        }
    }
    __decorate([
        query('.mdc-ripple-surface')
    ], RippleBase.prototype, "mdcRoot", void 0);
    __decorate([
        property({ type: Boolean })
    ], RippleBase.prototype, "primary", void 0);
    __decorate([
        property({ type: Boolean })
    ], RippleBase.prototype, "accent", void 0);
    __decorate([
        property({ type: Boolean })
    ], RippleBase.prototype, "unbounded", void 0);
    __decorate([
        property({ type: Boolean })
    ], RippleBase.prototype, "disabled", void 0);
    __decorate([
        property({ type: Boolean })
    ], RippleBase.prototype, "activated", void 0);
    __decorate([
        property({ type: Boolean })
    ], RippleBase.prototype, "selected", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "hovering", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "bgFocused", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "fgActivation", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "fgDeactivation", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "fgScale", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "fgSize", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "translateStart", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "translateEnd", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "leftPos", void 0);
    __decorate([
        internalProperty()
    ], RippleBase.prototype, "topPos", void 0);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$1 = css `.mdc-ripple-surface{--mdc-ripple-fg-size: 0;--mdc-ripple-left: 0;--mdc-ripple-top: 0;--mdc-ripple-fg-scale: 1;--mdc-ripple-fg-translate-end: 0;--mdc-ripple-fg-translate-start: 0;-webkit-tap-highlight-color:rgba(0,0,0,0);will-change:transform,opacity;position:relative;outline:none;overflow:hidden}.mdc-ripple-surface::before,.mdc-ripple-surface::after{position:absolute;border-radius:50%;opacity:0;pointer-events:none;content:""}.mdc-ripple-surface::before{transition:opacity 15ms linear,background-color 15ms linear;z-index:1;z-index:var(--mdc-ripple-z-index, 1)}.mdc-ripple-surface::after{z-index:0;z-index:var(--mdc-ripple-z-index, 0)}.mdc-ripple-surface.mdc-ripple-upgraded::before{transform:scale(var(--mdc-ripple-fg-scale, 1))}.mdc-ripple-surface.mdc-ripple-upgraded::after{top:0;left:0;transform:scale(0);transform-origin:center center}.mdc-ripple-surface.mdc-ripple-upgraded--unbounded::after{top:var(--mdc-ripple-top, 0);left:var(--mdc-ripple-left, 0)}.mdc-ripple-surface.mdc-ripple-upgraded--foreground-activation::after{animation:mdc-ripple-fg-radius-in 225ms forwards,mdc-ripple-fg-opacity-in 75ms forwards}.mdc-ripple-surface.mdc-ripple-upgraded--foreground-deactivation::after{animation:mdc-ripple-fg-opacity-out 150ms;transform:translate(var(--mdc-ripple-fg-translate-end, 0)) scale(var(--mdc-ripple-fg-scale, 1))}.mdc-ripple-surface::before,.mdc-ripple-surface::after{background-color:#000;background-color:var(--mdc-ripple-color, #000)}.mdc-ripple-surface:hover::before,.mdc-ripple-surface.mdc-ripple-surface--hover::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-ripple-surface.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-ripple-surface:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface::before,.mdc-ripple-surface::after{top:calc(50% - 100%);left:calc(50% - 100%);width:200%;height:200%}.mdc-ripple-surface.mdc-ripple-upgraded::after{width:var(--mdc-ripple-fg-size, 100%);height:var(--mdc-ripple-fg-size, 100%)}.mdc-ripple-surface[data-mdc-ripple-is-unbounded],.mdc-ripple-upgraded--unbounded{overflow:visible}.mdc-ripple-surface[data-mdc-ripple-is-unbounded]::before,.mdc-ripple-surface[data-mdc-ripple-is-unbounded]::after,.mdc-ripple-upgraded--unbounded::before,.mdc-ripple-upgraded--unbounded::after{top:calc(50% - 50%);left:calc(50% - 50%);width:100%;height:100%}.mdc-ripple-surface[data-mdc-ripple-is-unbounded].mdc-ripple-upgraded::before,.mdc-ripple-surface[data-mdc-ripple-is-unbounded].mdc-ripple-upgraded::after,.mdc-ripple-upgraded--unbounded.mdc-ripple-upgraded::before,.mdc-ripple-upgraded--unbounded.mdc-ripple-upgraded::after{top:var(--mdc-ripple-top, calc(50% - 50%));left:var(--mdc-ripple-left, calc(50% - 50%));width:var(--mdc-ripple-fg-size, 100%);height:var(--mdc-ripple-fg-size, 100%)}.mdc-ripple-surface[data-mdc-ripple-is-unbounded].mdc-ripple-upgraded::after,.mdc-ripple-upgraded--unbounded.mdc-ripple-upgraded::after{width:var(--mdc-ripple-fg-size, 100%);height:var(--mdc-ripple-fg-size, 100%)}@keyframes mdc-ripple-fg-radius-in{from{animation-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transform:translate(var(--mdc-ripple-fg-translate-start, 0)) scale(1)}to{transform:translate(var(--mdc-ripple-fg-translate-end, 0)) scale(var(--mdc-ripple-fg-scale, 1))}}@keyframes mdc-ripple-fg-opacity-in{from{animation-timing-function:linear;opacity:0}to{opacity:var(--mdc-ripple-fg-opacity, 0)}}@keyframes mdc-ripple-fg-opacity-out{from{animation-timing-function:linear;opacity:var(--mdc-ripple-fg-opacity, 0)}to{opacity:0}}:host{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:block}:host .mdc-ripple-surface{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;will-change:unset}.mdc-ripple-surface--primary::before,.mdc-ripple-surface--primary::after{background-color:#6200ee;background-color:var(--mdc-ripple-color, var(--mdc-theme-primary, #6200ee))}.mdc-ripple-surface--primary:hover::before,.mdc-ripple-surface--primary.mdc-ripple-surface--hover::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-ripple-surface--primary.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--primary:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-ripple-surface--primary:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--primary:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--primary.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--primary--activated::before{opacity:0.12;opacity:var(--mdc-ripple-activated-opacity, 0.12)}.mdc-ripple-surface--primary--activated::before,.mdc-ripple-surface--primary--activated::after{background-color:#6200ee;background-color:var(--mdc-ripple-color, var(--mdc-theme-primary, #6200ee))}.mdc-ripple-surface--primary--activated:hover::before,.mdc-ripple-surface--primary--activated.mdc-ripple-surface--hover::before{opacity:0.16;opacity:var(--mdc-ripple-hover-opacity, 0.16)}.mdc-ripple-surface--primary--activated.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--primary--activated:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-focus-opacity, 0.24)}.mdc-ripple-surface--primary--activated:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--primary--activated:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--primary--activated.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--primary--selected::before{opacity:0.08;opacity:var(--mdc-ripple-selected-opacity, 0.08)}.mdc-ripple-surface--primary--selected::before,.mdc-ripple-surface--primary--selected::after{background-color:#6200ee;background-color:var(--mdc-ripple-color, var(--mdc-theme-primary, #6200ee))}.mdc-ripple-surface--primary--selected:hover::before,.mdc-ripple-surface--primary--selected.mdc-ripple-surface--hover::before{opacity:0.12;opacity:var(--mdc-ripple-hover-opacity, 0.12)}.mdc-ripple-surface--primary--selected.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--primary--selected:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-focus-opacity, 0.2)}.mdc-ripple-surface--primary--selected:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--primary--selected:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--primary--selected.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--accent::before,.mdc-ripple-surface--accent::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-ripple-surface--accent:hover::before,.mdc-ripple-surface--accent.mdc-ripple-surface--hover::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-ripple-surface--accent.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--accent:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-ripple-surface--accent:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--accent:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--accent.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--accent--activated::before{opacity:0.12;opacity:var(--mdc-ripple-activated-opacity, 0.12)}.mdc-ripple-surface--accent--activated::before,.mdc-ripple-surface--accent--activated::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-ripple-surface--accent--activated:hover::before,.mdc-ripple-surface--accent--activated.mdc-ripple-surface--hover::before{opacity:0.16;opacity:var(--mdc-ripple-hover-opacity, 0.16)}.mdc-ripple-surface--accent--activated.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--accent--activated:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-focus-opacity, 0.24)}.mdc-ripple-surface--accent--activated:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--accent--activated:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--accent--activated.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--accent--selected::before{opacity:0.08;opacity:var(--mdc-ripple-selected-opacity, 0.08)}.mdc-ripple-surface--accent--selected::before,.mdc-ripple-surface--accent--selected::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-ripple-surface--accent--selected:hover::before,.mdc-ripple-surface--accent--selected.mdc-ripple-surface--hover::before{opacity:0.12;opacity:var(--mdc-ripple-hover-opacity, 0.12)}.mdc-ripple-surface--accent--selected.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--accent--selected:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-focus-opacity, 0.2)}.mdc-ripple-surface--accent--selected:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--accent--selected:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--accent--selected.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--disabled{opacity:0}`;

    /** @soyCompatible */
    let Ripple = class Ripple extends RippleBase {
    };
    Ripple.styles = style$1;
    Ripple = __decorate([
        customElement('mwc-ripple')
    ], Ripple);

    /**
    @license
    Copyright 2020 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    /**
     * Class that encapsulates the events handlers for `mwc-ripple`
     *
     *
     * Example:
     * ```
     * class XFoo extends LitElement {
     *   async getRipple() {
     *     this.renderRipple = true;
     *     await this.updateComplete;
     *     return this.renderRoot.querySelector('mwc-ripple');
     *   }
     *   rippleHandlers = new RippleHandlers(() => this.getRipple());
     *
     *   render() {
     *     return html`
     *       <div @mousedown=${this.rippleHandlers.startPress}></div>
     *       ${this.renderRipple ? html`<mwc-ripple></mwc-ripple>` : ''}
     *     `;
     *   }
     * }
     * ```
     */
    class RippleHandlers {
        constructor(
        /** Function that returns a `mwc-ripple` */
        rippleFn) {
            this.startPress = (ev) => {
                rippleFn().then((r) => {
                    r && r.startPress(ev);
                });
            };
            this.endPress = () => {
                rippleFn().then((r) => {
                    r && r.endPress();
                });
            };
            this.startFocus = () => {
                rippleFn().then((r) => {
                    r && r.startFocus();
                });
            };
            this.endFocus = () => {
                rippleFn().then((r) => {
                    r && r.endFocus();
                });
            };
            this.startHover = () => {
                rippleFn().then((r) => {
                    r && r.startHover();
                });
            };
            this.endHover = () => {
                rippleFn().then((r) => {
                    r && r.endHover();
                });
            };
        }
    }

    /** @soyCompatible */
    class ButtonBase extends LitElement {
        constructor() {
            super(...arguments);
            this.raised = false;
            this.unelevated = false;
            this.outlined = false;
            this.dense = false;
            this.disabled = false;
            this.trailingIcon = false;
            this.fullwidth = false;
            this.icon = '';
            this.label = '';
            this.expandContent = false;
            this.shouldRenderRipple = false;
            this.rippleHandlers = new RippleHandlers(() => {
                this.shouldRenderRipple = true;
                return this.ripple;
            });
        }
        /** @soyTemplate */
        renderOverlay() {
            return html ``;
        }
        /** @soyTemplate */
        renderRipple() {
            const filled = this.raised || this.unelevated;
            return this.shouldRenderRipple ?
                html `<mwc-ripple class="ripple" .primary="${!filled}" .disabled="${this.disabled}"></mwc-ripple>` :
                '';
        }
        createRenderRoot() {
            return this.attachShadow({ mode: 'open', delegatesFocus: true });
        }
        focus() {
            const buttonElement = this.buttonElement;
            if (buttonElement) {
                this.rippleHandlers.startFocus();
                buttonElement.focus();
            }
        }
        blur() {
            const buttonElement = this.buttonElement;
            if (buttonElement) {
                this.rippleHandlers.endFocus();
                buttonElement.blur();
            }
        }
        /** @soyTemplate classMap */
        getRenderClasses() {
            return classMap({
                'mdc-button--raised': this.raised,
                'mdc-button--unelevated': this.unelevated,
                'mdc-button--outlined': this.outlined,
                'mdc-button--dense': this.dense,
            });
        }
        /**
         * @soyTemplate
         * @soyAttributes buttonAttributes: #button
         * @soyClasses buttonClasses: #button
         */
        render() {
            return html `
      <button
          id="button"
          class="mdc-button ${this.getRenderClasses()}"
          ?disabled="${this.disabled}"
          aria-label="${this.label || this.icon}"
          @focus="${this.handleRippleFocus}"
          @blur="${this.handleRippleBlur}"
          @mousedown="${this.handleRippleActivate}"
          @mouseenter="${this.handleRippleMouseEnter}"
          @mouseleave="${this.handleRippleMouseLeave}"
          @touchstart="${this.handleRippleActivate}"
          @touchend="${this.handleRippleDeactivate}"
          @touchcancel="${this.handleRippleDeactivate}">
        ${this.renderOverlay()}
        ${this.renderRipple()}
        <span class="leading-icon">
          <slot name="icon">
            ${this.icon && !this.trailingIcon ? this.renderIcon() : ''}
          </slot>
        </span>
        <span class="mdc-button__label">${this.label}</span>
        <span class="slot-container ${classMap({
            flex: this.expandContent
        })}">
          <slot></slot>
        </span>
        <span class="trailing-icon">
          <slot name="trailingIcon">
            ${this.icon && this.trailingIcon ? this.renderIcon() : ''}
          </slot>
        </span>
      </button>`;
        }
        /** @soyTemplate */
        renderIcon() {
            return html `
    <mwc-icon class="mdc-button__icon">
      ${this.icon}
    </mwc-icon>`;
        }
        handleRippleActivate(evt) {
            const onUp = () => {
                window.removeEventListener('mouseup', onUp);
                this.handleRippleDeactivate();
            };
            window.addEventListener('mouseup', onUp);
            this.rippleHandlers.startPress(evt);
        }
        handleRippleDeactivate() {
            this.rippleHandlers.endPress();
        }
        handleRippleMouseEnter() {
            this.rippleHandlers.startHover();
        }
        handleRippleMouseLeave() {
            this.rippleHandlers.endHover();
        }
        handleRippleFocus() {
            this.rippleHandlers.startFocus();
        }
        handleRippleBlur() {
            this.rippleHandlers.endFocus();
        }
    }
    __decorate([
        property({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "raised", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "unelevated", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "outlined", void 0);
    __decorate([
        property({ type: Boolean })
    ], ButtonBase.prototype, "dense", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "disabled", void 0);
    __decorate([
        property({ type: Boolean, attribute: 'trailingicon' })
    ], ButtonBase.prototype, "trailingIcon", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "fullwidth", void 0);
    __decorate([
        property({ type: String })
    ], ButtonBase.prototype, "icon", void 0);
    __decorate([
        property({ type: String })
    ], ButtonBase.prototype, "label", void 0);
    __decorate([
        property({ type: Boolean })
    ], ButtonBase.prototype, "expandContent", void 0);
    __decorate([
        query('#button')
    ], ButtonBase.prototype, "buttonElement", void 0);
    __decorate([
        queryAsync('mwc-ripple')
    ], ButtonBase.prototype, "ripple", void 0);
    __decorate([
        internalProperty()
    ], ButtonBase.prototype, "shouldRenderRipple", void 0);
    __decorate([
        eventOptions({ passive: true })
    ], ButtonBase.prototype, "handleRippleActivate", null);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$2 = css `.mdc-touch-target-wrapper{display:inline}.mdc-elevation-overlay{position:absolute;border-radius:inherit;pointer-events:none;opacity:0;opacity:var(--mdc-elevation-overlay-opacity, 0);transition:opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);background-color:#fff;background-color:var(--mdc-elevation-overlay-color, #fff)}.mdc-button{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-button-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.875rem;font-size:var(--mdc-typography-button-font-size, 0.875rem);line-height:2.25rem;line-height:var(--mdc-typography-button-line-height, 2.25rem);font-weight:500;font-weight:var(--mdc-typography-button-font-weight, 500);letter-spacing:0.0892857143em;letter-spacing:var(--mdc-typography-button-letter-spacing, 0.0892857143em);text-decoration:none;text-decoration:var(--mdc-typography-button-text-decoration, none);text-transform:uppercase;text-transform:var(--mdc-typography-button-text-transform, uppercase);padding:0 8px 0 8px;position:relative;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:64px;border:none;outline:none;line-height:inherit;user-select:none;-webkit-appearance:none;overflow:visible;vertical-align:middle;border-radius:4px;border-radius:var(--mdc-shape-small, 4px);height:36px}.mdc-button .mdc-elevation-overlay{width:100%;height:100%;top:0;left:0}.mdc-button::-moz-focus-inner{padding:0;border:0}.mdc-button:active{outline:none}.mdc-button:hover{cursor:pointer}.mdc-button:disabled{cursor:default;pointer-events:none}.mdc-button .mdc-button__ripple{border-radius:4px;border-radius:var(--mdc-shape-small, 4px)}.mdc-button:not(:disabled){background-color:transparent}.mdc-button:disabled{background-color:transparent}.mdc-button .mdc-button__icon{margin-left:0;margin-right:8px;display:inline-block;width:18px;height:18px;font-size:18px;vertical-align:top}[dir=rtl] .mdc-button .mdc-button__icon,.mdc-button .mdc-button__icon[dir=rtl]{margin-left:8px;margin-right:0}.mdc-button .mdc-button__touch{position:absolute;top:50%;right:0;height:48px;left:0;transform:translateY(-50%)}.mdc-button:not(:disabled){color:#6200ee;color:var(--mdc-theme-primary, #6200ee)}.mdc-button:disabled{color:rgba(0, 0, 0, 0.38)}.mdc-button__label+.mdc-button__icon{margin-left:8px;margin-right:0}[dir=rtl] .mdc-button__label+.mdc-button__icon,.mdc-button__label+.mdc-button__icon[dir=rtl]{margin-left:0;margin-right:8px}svg.mdc-button__icon{fill:currentColor}.mdc-button--raised .mdc-button__icon,.mdc-button--unelevated .mdc-button__icon,.mdc-button--outlined .mdc-button__icon{margin-left:-4px;margin-right:8px}[dir=rtl] .mdc-button--raised .mdc-button__icon,.mdc-button--raised .mdc-button__icon[dir=rtl],[dir=rtl] .mdc-button--unelevated .mdc-button__icon,.mdc-button--unelevated .mdc-button__icon[dir=rtl],[dir=rtl] .mdc-button--outlined .mdc-button__icon,.mdc-button--outlined .mdc-button__icon[dir=rtl]{margin-left:8px;margin-right:-4px}.mdc-button--raised .mdc-button__label+.mdc-button__icon,.mdc-button--unelevated .mdc-button__label+.mdc-button__icon,.mdc-button--outlined .mdc-button__label+.mdc-button__icon{margin-left:8px;margin-right:-4px}[dir=rtl] .mdc-button--raised .mdc-button__label+.mdc-button__icon,.mdc-button--raised .mdc-button__label+.mdc-button__icon[dir=rtl],[dir=rtl] .mdc-button--unelevated .mdc-button__label+.mdc-button__icon,.mdc-button--unelevated .mdc-button__label+.mdc-button__icon[dir=rtl],[dir=rtl] .mdc-button--outlined .mdc-button__label+.mdc-button__icon,.mdc-button--outlined .mdc-button__label+.mdc-button__icon[dir=rtl]{margin-left:-4px;margin-right:8px}.mdc-button--raised,.mdc-button--unelevated{padding:0 16px 0 16px}.mdc-button--raised:not(:disabled),.mdc-button--unelevated:not(:disabled){background-color:#6200ee;background-color:var(--mdc-theme-primary, #6200ee)}.mdc-button--raised:not(:disabled),.mdc-button--unelevated:not(:disabled){color:#fff;color:var(--mdc-theme-on-primary, #fff)}.mdc-button--raised:disabled,.mdc-button--unelevated:disabled{background-color:rgba(0, 0, 0, 0.12)}.mdc-button--raised:disabled,.mdc-button--unelevated:disabled{color:rgba(0, 0, 0, 0.38)}.mdc-button--raised{box-shadow:0px 3px 1px -2px rgba(0, 0, 0, 0.2),0px 2px 2px 0px rgba(0, 0, 0, 0.14),0px 1px 5px 0px rgba(0,0,0,.12);transition:box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1)}.mdc-button--raised:hover,.mdc-button--raised:focus{box-shadow:0px 2px 4px -1px rgba(0, 0, 0, 0.2),0px 4px 5px 0px rgba(0, 0, 0, 0.14),0px 1px 10px 0px rgba(0,0,0,.12)}.mdc-button--raised:active{box-shadow:0px 5px 5px -3px rgba(0, 0, 0, 0.2),0px 8px 10px 1px rgba(0, 0, 0, 0.14),0px 3px 14px 2px rgba(0,0,0,.12)}.mdc-button--raised:disabled{box-shadow:0px 0px 0px 0px rgba(0, 0, 0, 0.2),0px 0px 0px 0px rgba(0, 0, 0, 0.14),0px 0px 0px 0px rgba(0,0,0,.12)}.mdc-button--outlined{padding:0 15px 0 15px;border-width:1px;border-style:solid}.mdc-button--outlined .mdc-button__ripple{top:-1px;left:-1px;border:1px solid transparent}.mdc-button--outlined .mdc-button__touch{left:-1px;width:calc(100% + 2 * 1px)}.mdc-button--outlined:not(:disabled){border-color:rgba(0, 0, 0, 0.12)}.mdc-button--outlined:disabled{border-color:rgba(0, 0, 0, 0.12)}.mdc-button--touch{margin-top:6px;margin-bottom:6px}:host{display:inline-flex;outline:none;-webkit-tap-highlight-color:transparent;vertical-align:top}:host([fullwidth]){width:100%}:host([raised]),:host([unelevated]){--mdc-ripple-color: #fff;--mdc-ripple-focus-opacity: 0.24;--mdc-ripple-hover-opacity: 0.08;--mdc-ripple-press-opacity: 0.24}.trailing-icon ::slotted(*),.trailing-icon .mdc-button__icon,.leading-icon ::slotted(*),.leading-icon .mdc-button__icon{margin-left:0;margin-right:8px;display:inline-block;width:18px;height:18px;font-size:18px;vertical-align:top}[dir=rtl] .trailing-icon ::slotted(*),.trailing-icon ::slotted(*)[dir=rtl],[dir=rtl] .trailing-icon .mdc-button__icon,.trailing-icon .mdc-button__icon[dir=rtl],[dir=rtl] .leading-icon ::slotted(*),.leading-icon ::slotted(*)[dir=rtl],[dir=rtl] .leading-icon .mdc-button__icon,.leading-icon .mdc-button__icon[dir=rtl]{margin-left:8px;margin-right:0}.trailing-icon ::slotted(*),.trailing-icon .mdc-button__icon{margin-left:8px;margin-right:0}[dir=rtl] .trailing-icon ::slotted(*),.trailing-icon ::slotted(*)[dir=rtl],[dir=rtl] .trailing-icon .mdc-button__icon,.trailing-icon .mdc-button__icon[dir=rtl]{margin-left:0;margin-right:8px}.slot-container{display:inline-flex;align-items:center;justify-content:center}.slot-container.flex{flex:auto}.mdc-button{flex:auto;overflow:hidden;padding-left:8px;padding-left:var(--mdc-button-horizontal-padding, 8px);padding-right:8px;padding-right:var(--mdc-button-horizontal-padding, 8px)}.mdc-button--raised{box-shadow:0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow, 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12))}.mdc-button--raised:focus{box-shadow:0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-focus, var(--mdc-button-raised-box-shadow-hover, 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)))}.mdc-button--raised:hover{box-shadow:0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-hover, 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12))}.mdc-button--raised:active{box-shadow:0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-active, 0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12))}.mdc-button--raised:disabled{box-shadow:0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-disabled, 0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12))}.mdc-button--raised,.mdc-button--unelevated{padding-left:16px;padding-left:var(--mdc-button-horizontal-padding, 16px);padding-right:16px;padding-right:var(--mdc-button-horizontal-padding, 16px)}.mdc-button--outlined{border-width:1px;border-width:var(--mdc-button-outline-width, 1px);padding-left:calc(16px - 1px);padding-left:calc(var(--mdc-button-horizontal-padding, 16px) - var(--mdc-button-outline-width, 1px));padding-right:calc(16px - 1px);padding-right:calc(var(--mdc-button-horizontal-padding, 16px) - var(--mdc-button-outline-width, 1px))}.mdc-button--outlined:not(:disabled){border-color:rgba(0, 0, 0, 0.12);border-color:var(--mdc-button-outline-color, rgba(0, 0, 0, 0.12))}.mdc-button--outlined .ripple{top:calc(-1 * 1px);top:calc(-1 * var(--mdc-button-outline-width, 1px));left:calc(-1 * 1px);left:calc(-1 * var(--mdc-button-outline-width, 1px));right:initial;border-width:1px;border-width:var(--mdc-button-outline-width, 1px);border-style:solid;border-color:transparent}[dir=rtl] .mdc-button--outlined .ripple,.mdc-button--outlined .ripple[dir=rtl]{left:initial;right:calc(-1 * 1px);right:calc(-1 * var(--mdc-button-outline-width, 1px))}.mdc-button--dense{height:28px;margin-top:0;margin-bottom:0}.mdc-button--dense .mdc-button__touch{display:none}:host([disabled]){pointer-events:none}:host([disabled]) .mdc-button{color:rgba(0, 0, 0, 0.38);color:var(--mdc-button-disabled-ink-color, rgba(0, 0, 0, 0.38))}:host([disabled]) .mdc-button--raised,:host([disabled]) .mdc-button--unelevated{background-color:rgba(0, 0, 0, 0.12);background-color:var(--mdc-button-disabled-fill-color, rgba(0, 0, 0, 0.12))}:host([disabled]) .mdc-button--outlined{border-color:rgba(0, 0, 0, 0.12);border-color:var(--mdc-button-disabled-outline-color, rgba(0, 0, 0, 0.12))}`;

    /** @soyCompatible */
    let Button = class Button extends ButtonBase {
    };
    Button.styles = style$2;
    Button = __decorate([
        customElement('mwc-button')
    ], Button);

    /** @soyCompatible */
    class IconButtonBase extends LitElement {
        constructor() {
            super(...arguments);
            this.disabled = false;
            this.icon = '';
            this.label = '';
            this.shouldRenderRipple = false;
            this.rippleHandlers = new RippleHandlers(() => {
                this.shouldRenderRipple = true;
                return this.ripple;
            });
        }
        /** @soyTemplate */
        renderRipple() {
            return this.shouldRenderRipple ? html `
            <mwc-ripple
                .disabled="${this.disabled}"
                unbounded>
            </mwc-ripple>` :
                '';
        }
        focus() {
            const buttonElement = this.buttonElement;
            if (buttonElement) {
                this.rippleHandlers.startFocus();
                buttonElement.focus();
            }
        }
        blur() {
            const buttonElement = this.buttonElement;
            if (buttonElement) {
                this.rippleHandlers.endFocus();
                buttonElement.blur();
            }
        }
        /** @soyTemplate */
        render() {
            return html `<button
        class="mdc-icon-button"
        aria-label="${this.label || this.icon}"
        ?disabled="${this.disabled}"
        @focus="${this.handleRippleFocus}"
        @blur="${this.handleRippleBlur}"
        @mousedown="${this.handleRippleMouseDown}"
        @mouseenter="${this.handleRippleMouseEnter}"
        @mouseleave="${this.handleRippleMouseLeave}"
        @touchstart="${this.handleRippleTouchStart}"
        @touchend="${this.handleRippleDeactivate}"
        @touchcancel="${this.handleRippleDeactivate}">
      ${this.renderRipple()}
    <i class="material-icons">${this.icon}</i>
    <span class="default-slot-container">
        <slot></slot>
    </span>
  </button>`;
        }
        handleRippleMouseDown(event) {
            const onUp = () => {
                window.removeEventListener('mouseup', onUp);
                this.handleRippleDeactivate();
            };
            window.addEventListener('mouseup', onUp);
            this.rippleHandlers.startPress(event);
        }
        handleRippleTouchStart(event) {
            this.rippleHandlers.startPress(event);
        }
        handleRippleDeactivate() {
            this.rippleHandlers.endPress();
        }
        handleRippleMouseEnter() {
            this.rippleHandlers.startHover();
        }
        handleRippleMouseLeave() {
            this.rippleHandlers.endHover();
        }
        handleRippleFocus() {
            this.rippleHandlers.startFocus();
        }
        handleRippleBlur() {
            this.rippleHandlers.endFocus();
        }
    }
    __decorate([
        property({ type: Boolean, reflect: true })
    ], IconButtonBase.prototype, "disabled", void 0);
    __decorate([
        property({ type: String })
    ], IconButtonBase.prototype, "icon", void 0);
    __decorate([
        property({ type: String })
    ], IconButtonBase.prototype, "label", void 0);
    __decorate([
        query('button')
    ], IconButtonBase.prototype, "buttonElement", void 0);
    __decorate([
        queryAsync('mwc-ripple')
    ], IconButtonBase.prototype, "ripple", void 0);
    __decorate([
        internalProperty()
    ], IconButtonBase.prototype, "shouldRenderRipple", void 0);
    __decorate([
        eventOptions({ passive: true })
    ], IconButtonBase.prototype, "handleRippleMouseDown", null);
    __decorate([
        eventOptions({ passive: true })
    ], IconButtonBase.prototype, "handleRippleTouchStart", null);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$3 = css `.material-icons{font-family:var(--mdc-icon-font, "Material Icons");font-weight:normal;font-style:normal;font-size:var(--mdc-icon-size, 24px);line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;font-feature-settings:"liga"}.mdc-icon-button{display:inline-block;position:relative;box-sizing:border-box;border:none;outline:none;background-color:transparent;fill:currentColor;color:inherit;font-size:24px;text-decoration:none;cursor:pointer;user-select:none;width:48px;height:48px;padding:12px}.mdc-icon-button svg,.mdc-icon-button img{width:24px;height:24px}.mdc-icon-button:disabled{color:rgba(0, 0, 0, 0.38);color:var(--mdc-theme-text-disabled-on-light, rgba(0, 0, 0, 0.38))}.mdc-icon-button:disabled{cursor:default;pointer-events:none}.mdc-icon-button__icon{display:inline-block}.mdc-icon-button__icon.mdc-icon-button__icon--on{display:none}.mdc-icon-button--on .mdc-icon-button__icon{display:none}.mdc-icon-button--on .mdc-icon-button__icon.mdc-icon-button__icon--on{display:inline-block}:host{display:inline-block;outline:none;--mdc-ripple-color: currentcolor;-webkit-tap-highlight-color:transparent}:host([disabled]){pointer-events:none}:host,.mdc-icon-button{vertical-align:top}.mdc-icon-button{width:var(--mdc-icon-button-size, 48px);height:var(--mdc-icon-button-size, 48px);padding:calc( (var(--mdc-icon-button-size, 48px) - var(--mdc-icon-size, 24px)) / 2 )}.mdc-icon-button>i{position:absolute;top:0;padding-top:inherit}.mdc-icon-button i,.mdc-icon-button svg,.mdc-icon-button img,.mdc-icon-button ::slotted(*){display:block;width:var(--mdc-icon-size, 24px);height:var(--mdc-icon-size, 24px)}`;

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    /** @soyCompatible */
    let IconButton = class IconButton extends IconButtonBase {
    };
    IconButton.styles = style$3;
    IconButton = __decorate([
        customElement('mwc-icon-button')
    ], IconButton);

    /**
     * @license
     * Copyright 2016 Google Inc. All rights reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *     http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    (() => {
        var _a, _b, _c;
        /* Symbols for private properties */
        const _blockingElements = Symbol();
        const _alreadyInertElements = Symbol();
        const _topElParents = Symbol();
        const _siblingsToRestore = Symbol();
        const _parentMO = Symbol();
        /* Symbols for private static methods */
        const _topChanged = Symbol();
        const _swapInertedSibling = Symbol();
        const _inertSiblings = Symbol();
        const _restoreInertedSiblings = Symbol();
        const _getParents = Symbol();
        const _getDistributedChildren = Symbol();
        const _isInertable = Symbol();
        const _handleMutations = Symbol();
        class BlockingElementsImpl {
            constructor() {
                /**
                 * The blocking elements.
                 */
                this[_a] = [];
                /**
                 * Used to keep track of the parents of the top element, from the element
                 * itself up to body. When top changes, the old top might have been removed
                 * from the document, so we need to memoize the inerted parents' siblings
                 * in order to restore their inerteness when top changes.
                 */
                this[_b] = [];
                /**
                 * Elements that are already inert before the first blocking element is
                 * pushed.
                 */
                this[_c] = new Set();
            }
            destructor() {
                // Restore original inertness.
                this[_restoreInertedSiblings](this[_topElParents]);
                // Note we don't want to make these properties nullable on the class,
                // since then we'd need non-null casts in many places. Calling a method on
                // a BlockingElements instance after calling destructor will result in an
                // exception.
                const nullable = this;
                nullable[_blockingElements] = null;
                nullable[_topElParents] = null;
                nullable[_alreadyInertElements] = null;
            }
            get top() {
                const elems = this[_blockingElements];
                return elems[elems.length - 1] || null;
            }
            push(element) {
                if (!element || element === this.top) {
                    return;
                }
                // Remove it from the stack, we'll bring it to the top.
                this.remove(element);
                this[_topChanged](element);
                this[_blockingElements].push(element);
            }
            remove(element) {
                const i = this[_blockingElements].indexOf(element);
                if (i === -1) {
                    return false;
                }
                this[_blockingElements].splice(i, 1);
                // Top changed only if the removed element was the top element.
                if (i === this[_blockingElements].length) {
                    this[_topChanged](this.top);
                }
                return true;
            }
            pop() {
                const top = this.top;
                top && this.remove(top);
                return top;
            }
            has(element) {
                return this[_blockingElements].indexOf(element) !== -1;
            }
            /**
             * Sets `inert` to all document elements except the new top element, its
             * parents, and its distributed content.
             */
            [(_a = _blockingElements, _b = _topElParents, _c = _alreadyInertElements, _topChanged)](newTop) {
                const toKeepInert = this[_alreadyInertElements];
                const oldParents = this[_topElParents];
                // No new top, reset old top if any.
                if (!newTop) {
                    this[_restoreInertedSiblings](oldParents);
                    toKeepInert.clear();
                    this[_topElParents] = [];
                    return;
                }
                const newParents = this[_getParents](newTop);
                // New top is not contained in the main document!
                if (newParents[newParents.length - 1].parentNode !== document.body) {
                    throw Error('Non-connected element cannot be a blocking element');
                }
                // Cast here because we know we'll call _inertSiblings on newParents
                // below.
                this[_topElParents] = newParents;
                const toSkip = this[_getDistributedChildren](newTop);
                // No previous top element.
                if (!oldParents.length) {
                    this[_inertSiblings](newParents, toSkip, toKeepInert);
                    return;
                }
                let i = oldParents.length - 1;
                let j = newParents.length - 1;
                // Find common parent. Index 0 is the element itself (so stop before it).
                while (i > 0 && j > 0 && oldParents[i] === newParents[j]) {
                    i--;
                    j--;
                }
                // If up the parents tree there are 2 elements that are siblings, swap
                // the inerted sibling.
                if (oldParents[i] !== newParents[j]) {
                    this[_swapInertedSibling](oldParents[i], newParents[j]);
                }
                // Restore old parents siblings inertness.
                i > 0 && this[_restoreInertedSiblings](oldParents.slice(0, i));
                // Make new parents siblings inert.
                j > 0 && this[_inertSiblings](newParents.slice(0, j), toSkip, null);
            }
            /**
             * Swaps inertness between two sibling elements.
             * Sets the property `inert` over the attribute since the inert spec
             * doesn't specify if it should be reflected.
             * https://html.spec.whatwg.org/multipage/interaction.html#inert
             */
            [_swapInertedSibling](oldInert, newInert) {
                const siblingsToRestore = oldInert[_siblingsToRestore];
                // oldInert is not contained in siblings to restore, so we have to check
                // if it's inertable and if already inert.
                if (this[_isInertable](oldInert) && !oldInert.inert) {
                    oldInert.inert = true;
                    siblingsToRestore.add(oldInert);
                }
                // If newInert was already between the siblings to restore, it means it is
                // inertable and must be restored.
                if (siblingsToRestore.has(newInert)) {
                    newInert.inert = false;
                    siblingsToRestore.delete(newInert);
                }
                newInert[_parentMO] = oldInert[_parentMO];
                newInert[_siblingsToRestore] = siblingsToRestore;
                oldInert[_parentMO] = undefined;
                oldInert[_siblingsToRestore] = undefined;
            }
            /**
             * Restores original inertness to the siblings of the elements.
             * Sets the property `inert` over the attribute since the inert spec
             * doesn't specify if it should be reflected.
             * https://html.spec.whatwg.org/multipage/interaction.html#inert
             */
            [_restoreInertedSiblings](elements) {
                for (const element of elements) {
                    const mo = element[_parentMO];
                    mo.disconnect();
                    element[_parentMO] = undefined;
                    const siblings = element[_siblingsToRestore];
                    for (const sibling of siblings) {
                        sibling.inert = false;
                    }
                    element[_siblingsToRestore] = undefined;
                }
            }
            /**
             * Inerts the siblings of the elements except the elements to skip. Stores
             * the inerted siblings into the element's symbol `_siblingsToRestore`.
             * Pass `toKeepInert` to collect the already inert elements.
             * Sets the property `inert` over the attribute since the inert spec
             * doesn't specify if it should be reflected.
             * https://html.spec.whatwg.org/multipage/interaction.html#inert
             */
            [_inertSiblings](elements, toSkip, toKeepInert) {
                for (const element of elements) {
                    // Assume element is not a Document, so it must have a parentNode.
                    const parent = element.parentNode;
                    const children = parent.children;
                    const inertedSiblings = new Set();
                    for (let j = 0; j < children.length; j++) {
                        const sibling = children[j];
                        // Skip the input element, if not inertable or to be skipped.
                        if (sibling === element || !this[_isInertable](sibling) ||
                            (toSkip && toSkip.has(sibling))) {
                            continue;
                        }
                        // Should be collected since already inerted.
                        if (toKeepInert && sibling.inert) {
                            toKeepInert.add(sibling);
                        }
                        else {
                            sibling.inert = true;
                            inertedSiblings.add(sibling);
                        }
                    }
                    // Store the siblings that were inerted.
                    element[_siblingsToRestore] = inertedSiblings;
                    // Observe only immediate children mutations on the parent.
                    const mo = new MutationObserver(this[_handleMutations].bind(this));
                    element[_parentMO] = mo;
                    let parentToObserve = parent;
                    // If we're using the ShadyDOM polyfill, then our parent could be a
                    // shady root, which is an object that acts like a ShadowRoot, but isn't
                    // actually a node in the real DOM. Observe the real DOM parent instead.
                    const maybeShadyRoot = parentToObserve;
                    if (maybeShadyRoot.__shady && maybeShadyRoot.host) {
                        parentToObserve = maybeShadyRoot.host;
                    }
                    mo.observe(parentToObserve, {
                        childList: true,
                    });
                }
            }
            /**
             * Handles newly added/removed nodes by toggling their inertness.
             * It also checks if the current top Blocking Element has been removed,
             * notifying and removing it.
             */
            [_handleMutations](mutations) {
                const parents = this[_topElParents];
                const toKeepInert = this[_alreadyInertElements];
                for (const mutation of mutations) {
                    // If the target is a shadowRoot, get its host as we skip shadowRoots when
                    // computing _topElParents.
                    const target = mutation.target.host || mutation.target;
                    const idx = target === document.body ?
                        parents.length :
                        parents.indexOf(target);
                    const inertedChild = parents[idx - 1];
                    const inertedSiblings = inertedChild[_siblingsToRestore];
                    // To restore.
                    for (let i = 0; i < mutation.removedNodes.length; i++) {
                        const sibling = mutation.removedNodes[i];
                        if (sibling === inertedChild) {
                            console.info('Detected removal of the top Blocking Element.');
                            this.pop();
                            return;
                        }
                        if (inertedSiblings.has(sibling)) {
                            sibling.inert = false;
                            inertedSiblings.delete(sibling);
                        }
                    }
                    // To inert.
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const sibling = mutation.addedNodes[i];
                        if (!this[_isInertable](sibling)) {
                            continue;
                        }
                        if (toKeepInert && sibling.inert) {
                            toKeepInert.add(sibling);
                        }
                        else {
                            sibling.inert = true;
                            inertedSiblings.add(sibling);
                        }
                    }
                }
            }
            /**
             * Returns if the element is inertable.
             */
            [_isInertable](element) {
                return false === /^(style|template|script)$/.test(element.localName);
            }
            /**
             * Returns the list of newParents of an element, starting from element
             * (included) up to `document.body` (excluded).
             */
            [_getParents](element) {
                const parents = [];
                let current = element;
                // Stop to body.
                while (current && current !== document.body) {
                    // Skip shadow roots.
                    if (current.nodeType === Node.ELEMENT_NODE) {
                        parents.push(current);
                    }
                    // ShadowDom v1
                    if (current.assignedSlot) {
                        // Collect slots from deepest slot to top.
                        while (current = current.assignedSlot) {
                            parents.push(current);
                        }
                        // Continue the search on the top slot.
                        current = parents.pop();
                        continue;
                    }
                    current = current.parentNode ||
                        current.host;
                }
                return parents;
            }
            /**
             * Returns the distributed children of the element's shadow root.
             * Returns null if the element doesn't have a shadow root.
             */
            [_getDistributedChildren](element) {
                const shadowRoot = element.shadowRoot;
                if (!shadowRoot) {
                    return null;
                }
                const result = new Set();
                let i;
                let j;
                let nodes;
                const slots = shadowRoot.querySelectorAll('slot');
                if (slots.length && slots[0].assignedNodes) {
                    for (i = 0; i < slots.length; i++) {
                        nodes = slots[i].assignedNodes({
                            flatten: true,
                        });
                        for (j = 0; j < nodes.length; j++) {
                            if (nodes[j].nodeType === Node.ELEMENT_NODE) {
                                result.add(nodes[j]);
                            }
                        }
                    }
                    // No need to search for <content>.
                }
                return result;
            }
        }
        document.$blockingElements =
            new BlockingElementsImpl();
    })();

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    /**
     * This work is licensed under the W3C Software and Document License
     * (http://www.w3.org/Consortium/Legal/2015/copyright-software-and-document).
     */

    (function () {
      // Return early if we're not running inside of the browser.
      if (typeof window === 'undefined') {
        return;
      }

      // Convenience function for converting NodeLists.
      /** @type {typeof Array.prototype.slice} */
      var slice = Array.prototype.slice;

      /**
       * IE has a non-standard name for "matches".
       * @type {typeof Element.prototype.matches}
       */
      var matches = Element.prototype.matches || Element.prototype.msMatchesSelector;

      /** @type {string} */
      var _focusableElementsString = ['a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', 'button:not([disabled])', 'details', 'summary', 'iframe', 'object', 'embed', '[contenteditable]'].join(',');

      /**
       * `InertRoot` manages a single inert subtree, i.e. a DOM subtree whose root element has an `inert`
       * attribute.
       *
       * Its main functions are:
       *
       * - to create and maintain a set of managed `InertNode`s, including when mutations occur in the
       *   subtree. The `makeSubtreeUnfocusable()` method handles collecting `InertNode`s via registering
       *   each focusable node in the subtree with the singleton `InertManager` which manages all known
       *   focusable nodes within inert subtrees. `InertManager` ensures that a single `InertNode`
       *   instance exists for each focusable node which has at least one inert root as an ancestor.
       *
       * - to notify all managed `InertNode`s when this subtree stops being inert (i.e. when the `inert`
       *   attribute is removed from the root node). This is handled in the destructor, which calls the
       *   `deregister` method on `InertManager` for each managed inert node.
       */

      var InertRoot = function () {
        /**
         * @param {!Element} rootElement The Element at the root of the inert subtree.
         * @param {!InertManager} inertManager The global singleton InertManager object.
         */
        function InertRoot(rootElement, inertManager) {
          _classCallCheck(this, InertRoot);

          /** @type {!InertManager} */
          this._inertManager = inertManager;

          /** @type {!Element} */
          this._rootElement = rootElement;

          /**
           * @type {!Set<!InertNode>}
           * All managed focusable nodes in this InertRoot's subtree.
           */
          this._managedNodes = new Set();

          // Make the subtree hidden from assistive technology
          if (this._rootElement.hasAttribute('aria-hidden')) {
            /** @type {?string} */
            this._savedAriaHidden = this._rootElement.getAttribute('aria-hidden');
          } else {
            this._savedAriaHidden = null;
          }
          this._rootElement.setAttribute('aria-hidden', 'true');

          // Make all focusable elements in the subtree unfocusable and add them to _managedNodes
          this._makeSubtreeUnfocusable(this._rootElement);

          // Watch for:
          // - any additions in the subtree: make them unfocusable too
          // - any removals from the subtree: remove them from this inert root's managed nodes
          // - attribute changes: if `tabindex` is added, or removed from an intrinsically focusable
          //   element, make that node a managed node.
          this._observer = new MutationObserver(this._onMutation.bind(this));
          this._observer.observe(this._rootElement, { attributes: true, childList: true, subtree: true });
        }

        /**
         * Call this whenever this object is about to become obsolete.  This unwinds all of the state
         * stored in this object and updates the state of all of the managed nodes.
         */


        _createClass(InertRoot, [{
          key: 'destructor',
          value: function destructor() {
            this._observer.disconnect();

            if (this._rootElement) {
              if (this._savedAriaHidden !== null) {
                this._rootElement.setAttribute('aria-hidden', this._savedAriaHidden);
              } else {
                this._rootElement.removeAttribute('aria-hidden');
              }
            }

            this._managedNodes.forEach(function (inertNode) {
              this._unmanageNode(inertNode.node);
            }, this);

            // Note we cast the nulls to the ANY type here because:
            // 1) We want the class properties to be declared as non-null, or else we
            //    need even more casts throughout this code. All bets are off if an
            //    instance has been destroyed and a method is called.
            // 2) We don't want to cast "this", because we want type-aware optimizations
            //    to know which properties we're setting.
            this._observer = /** @type {?} */null;
            this._rootElement = /** @type {?} */null;
            this._managedNodes = /** @type {?} */null;
            this._inertManager = /** @type {?} */null;
          }

          /**
           * @return {!Set<!InertNode>} A copy of this InertRoot's managed nodes set.
           */

        }, {
          key: '_makeSubtreeUnfocusable',


          /**
           * @param {!Node} startNode
           */
          value: function _makeSubtreeUnfocusable(startNode) {
            var _this2 = this;

            composedTreeWalk(startNode, function (node) {
              return _this2._visitNode(node);
            });

            var activeElement = document.activeElement;

            if (!document.body.contains(startNode)) {
              // startNode may be in shadow DOM, so find its nearest shadowRoot to get the activeElement.
              var node = startNode;
              /** @type {!ShadowRoot|undefined} */
              var root = undefined;
              while (node) {
                if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                  root = /** @type {!ShadowRoot} */node;
                  break;
                }
                node = node.parentNode;
              }
              if (root) {
                activeElement = root.activeElement;
              }
            }
            if (startNode.contains(activeElement)) {
              activeElement.blur();
              // In IE11, if an element is already focused, and then set to tabindex=-1
              // calling blur() will not actually move the focus.
              // To work around this we call focus() on the body instead.
              if (activeElement === document.activeElement) {
                document.body.focus();
              }
            }
          }

          /**
           * @param {!Node} node
           */

        }, {
          key: '_visitNode',
          value: function _visitNode(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }
            var element = /** @type {!Element} */node;

            // If a descendant inert root becomes un-inert, its descendants will still be inert because of
            // this inert root, so all of its managed nodes need to be adopted by this InertRoot.
            if (element !== this._rootElement && element.hasAttribute('inert')) {
              this._adoptInertRoot(element);
            }

            if (matches.call(element, _focusableElementsString) || element.hasAttribute('tabindex')) {
              this._manageNode(element);
            }
          }

          /**
           * Register the given node with this InertRoot and with InertManager.
           * @param {!Node} node
           */

        }, {
          key: '_manageNode',
          value: function _manageNode(node) {
            var inertNode = this._inertManager.register(node, this);
            this._managedNodes.add(inertNode);
          }

          /**
           * Unregister the given node with this InertRoot and with InertManager.
           * @param {!Node} node
           */

        }, {
          key: '_unmanageNode',
          value: function _unmanageNode(node) {
            var inertNode = this._inertManager.deregister(node, this);
            if (inertNode) {
              this._managedNodes['delete'](inertNode);
            }
          }

          /**
           * Unregister the entire subtree starting at `startNode`.
           * @param {!Node} startNode
           */

        }, {
          key: '_unmanageSubtree',
          value: function _unmanageSubtree(startNode) {
            var _this3 = this;

            composedTreeWalk(startNode, function (node) {
              return _this3._unmanageNode(node);
            });
          }

          /**
           * If a descendant node is found with an `inert` attribute, adopt its managed nodes.
           * @param {!Element} node
           */

        }, {
          key: '_adoptInertRoot',
          value: function _adoptInertRoot(node) {
            var inertSubroot = this._inertManager.getInertRoot(node);

            // During initialisation this inert root may not have been registered yet,
            // so register it now if need be.
            if (!inertSubroot) {
              this._inertManager.setInert(node, true);
              inertSubroot = this._inertManager.getInertRoot(node);
            }

            inertSubroot.managedNodes.forEach(function (savedInertNode) {
              this._manageNode(savedInertNode.node);
            }, this);
          }

          /**
           * Callback used when mutation observer detects subtree additions, removals, or attribute changes.
           * @param {!Array<!MutationRecord>} records
           * @param {!MutationObserver} self
           */

        }, {
          key: '_onMutation',
          value: function _onMutation(records, self) {
            records.forEach(function (record) {
              var target = /** @type {!Element} */record.target;
              if (record.type === 'childList') {
                // Manage added nodes
                slice.call(record.addedNodes).forEach(function (node) {
                  this._makeSubtreeUnfocusable(node);
                }, this);

                // Un-manage removed nodes
                slice.call(record.removedNodes).forEach(function (node) {
                  this._unmanageSubtree(node);
                }, this);
              } else if (record.type === 'attributes') {
                if (record.attributeName === 'tabindex') {
                  // Re-initialise inert node if tabindex changes
                  this._manageNode(target);
                } else if (target !== this._rootElement && record.attributeName === 'inert' && target.hasAttribute('inert')) {
                  // If a new inert root is added, adopt its managed nodes and make sure it knows about the
                  // already managed nodes from this inert subroot.
                  this._adoptInertRoot(target);
                  var inertSubroot = this._inertManager.getInertRoot(target);
                  this._managedNodes.forEach(function (managedNode) {
                    if (target.contains(managedNode.node)) {
                      inertSubroot._manageNode(managedNode.node);
                    }
                  });
                }
              }
            }, this);
          }
        }, {
          key: 'managedNodes',
          get: function get() {
            return new Set(this._managedNodes);
          }

          /** @return {boolean} */

        }, {
          key: 'hasSavedAriaHidden',
          get: function get() {
            return this._savedAriaHidden !== null;
          }

          /** @param {?string} ariaHidden */

        }, {
          key: 'savedAriaHidden',
          set: function set(ariaHidden) {
            this._savedAriaHidden = ariaHidden;
          }

          /** @return {?string} */
          ,
          get: function get() {
            return this._savedAriaHidden;
          }
        }]);

        return InertRoot;
      }();

      /**
       * `InertNode` initialises and manages a single inert node.
       * A node is inert if it is a descendant of one or more inert root elements.
       *
       * On construction, `InertNode` saves the existing `tabindex` value for the node, if any, and
       * either removes the `tabindex` attribute or sets it to `-1`, depending on whether the element
       * is intrinsically focusable or not.
       *
       * `InertNode` maintains a set of `InertRoot`s which are descendants of this `InertNode`. When an
       * `InertRoot` is destroyed, and calls `InertManager.deregister()`, the `InertManager` notifies the
       * `InertNode` via `removeInertRoot()`, which in turn destroys the `InertNode` if no `InertRoot`s
       * remain in the set. On destruction, `InertNode` reinstates the stored `tabindex` if one exists,
       * or removes the `tabindex` attribute if the element is intrinsically focusable.
       */


      var InertNode = function () {
        /**
         * @param {!Node} node A focusable element to be made inert.
         * @param {!InertRoot} inertRoot The inert root element associated with this inert node.
         */
        function InertNode(node, inertRoot) {
          _classCallCheck(this, InertNode);

          /** @type {!Node} */
          this._node = node;

          /** @type {boolean} */
          this._overrodeFocusMethod = false;

          /**
           * @type {!Set<!InertRoot>} The set of descendant inert roots.
           *    If and only if this set becomes empty, this node is no longer inert.
           */
          this._inertRoots = new Set([inertRoot]);

          /** @type {?number} */
          this._savedTabIndex = null;

          /** @type {boolean} */
          this._destroyed = false;

          // Save any prior tabindex info and make this node untabbable
          this.ensureUntabbable();
        }

        /**
         * Call this whenever this object is about to become obsolete.
         * This makes the managed node focusable again and deletes all of the previously stored state.
         */


        _createClass(InertNode, [{
          key: 'destructor',
          value: function destructor() {
            this._throwIfDestroyed();

            if (this._node && this._node.nodeType === Node.ELEMENT_NODE) {
              var element = /** @type {!Element} */this._node;
              if (this._savedTabIndex !== null) {
                element.setAttribute('tabindex', this._savedTabIndex);
              } else {
                element.removeAttribute('tabindex');
              }

              // Use `delete` to restore native focus method.
              if (this._overrodeFocusMethod) {
                delete element.focus;
              }
            }

            // See note in InertRoot.destructor for why we cast these nulls to ANY.
            this._node = /** @type {?} */null;
            this._inertRoots = /** @type {?} */null;
            this._destroyed = true;
          }

          /**
           * @type {boolean} Whether this object is obsolete because the managed node is no longer inert.
           * If the object has been destroyed, any attempt to access it will cause an exception.
           */

        }, {
          key: '_throwIfDestroyed',


          /**
           * Throw if user tries to access destroyed InertNode.
           */
          value: function _throwIfDestroyed() {
            if (this.destroyed) {
              throw new Error('Trying to access destroyed InertNode');
            }
          }

          /** @return {boolean} */

        }, {
          key: 'ensureUntabbable',


          /** Save the existing tabindex value and make the node untabbable and unfocusable */
          value: function ensureUntabbable() {
            if (this.node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }
            var element = /** @type {!Element} */this.node;
            if (matches.call(element, _focusableElementsString)) {
              if ( /** @type {!HTMLElement} */element.tabIndex === -1 && this.hasSavedTabIndex) {
                return;
              }

              if (element.hasAttribute('tabindex')) {
                this._savedTabIndex = /** @type {!HTMLElement} */element.tabIndex;
              }
              element.setAttribute('tabindex', '-1');
              if (element.nodeType === Node.ELEMENT_NODE) {
                element.focus = function () {};
                this._overrodeFocusMethod = true;
              }
            } else if (element.hasAttribute('tabindex')) {
              this._savedTabIndex = /** @type {!HTMLElement} */element.tabIndex;
              element.removeAttribute('tabindex');
            }
          }

          /**
           * Add another inert root to this inert node's set of managing inert roots.
           * @param {!InertRoot} inertRoot
           */

        }, {
          key: 'addInertRoot',
          value: function addInertRoot(inertRoot) {
            this._throwIfDestroyed();
            this._inertRoots.add(inertRoot);
          }

          /**
           * Remove the given inert root from this inert node's set of managing inert roots.
           * If the set of managing inert roots becomes empty, this node is no longer inert,
           * so the object should be destroyed.
           * @param {!InertRoot} inertRoot
           */

        }, {
          key: 'removeInertRoot',
          value: function removeInertRoot(inertRoot) {
            this._throwIfDestroyed();
            this._inertRoots['delete'](inertRoot);
            if (this._inertRoots.size === 0) {
              this.destructor();
            }
          }
        }, {
          key: 'destroyed',
          get: function get() {
            return (/** @type {!InertNode} */this._destroyed
            );
          }
        }, {
          key: 'hasSavedTabIndex',
          get: function get() {
            return this._savedTabIndex !== null;
          }

          /** @return {!Node} */

        }, {
          key: 'node',
          get: function get() {
            this._throwIfDestroyed();
            return this._node;
          }

          /** @param {?number} tabIndex */

        }, {
          key: 'savedTabIndex',
          set: function set(tabIndex) {
            this._throwIfDestroyed();
            this._savedTabIndex = tabIndex;
          }

          /** @return {?number} */
          ,
          get: function get() {
            this._throwIfDestroyed();
            return this._savedTabIndex;
          }
        }]);

        return InertNode;
      }();

      /**
       * InertManager is a per-document singleton object which manages all inert roots and nodes.
       *
       * When an element becomes an inert root by having an `inert` attribute set and/or its `inert`
       * property set to `true`, the `setInert` method creates an `InertRoot` object for the element.
       * The `InertRoot` in turn registers itself as managing all of the element's focusable descendant
       * nodes via the `register()` method. The `InertManager` ensures that a single `InertNode` instance
       * is created for each such node, via the `_managedNodes` map.
       */


      var InertManager = function () {
        /**
         * @param {!Document} document
         */
        function InertManager(document) {
          _classCallCheck(this, InertManager);

          if (!document) {
            throw new Error('Missing required argument; InertManager needs to wrap a document.');
          }

          /** @type {!Document} */
          this._document = document;

          /**
           * All managed nodes known to this InertManager. In a map to allow looking up by Node.
           * @type {!Map<!Node, !InertNode>}
           */
          this._managedNodes = new Map();

          /**
           * All inert roots known to this InertManager. In a map to allow looking up by Node.
           * @type {!Map<!Node, !InertRoot>}
           */
          this._inertRoots = new Map();

          /**
           * Observer for mutations on `document.body`.
           * @type {!MutationObserver}
           */
          this._observer = new MutationObserver(this._watchForInert.bind(this));

          // Add inert style.
          addInertStyle(document.head || document.body || document.documentElement);

          // Wait for document to be loaded.
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this._onDocumentLoaded.bind(this));
          } else {
            this._onDocumentLoaded();
          }
        }

        /**
         * Set whether the given element should be an inert root or not.
         * @param {!Element} root
         * @param {boolean} inert
         */


        _createClass(InertManager, [{
          key: 'setInert',
          value: function setInert(root, inert) {
            if (inert) {
              if (this._inertRoots.has(root)) {
                // element is already inert
                return;
              }

              var inertRoot = new InertRoot(root, this);
              root.setAttribute('inert', '');
              this._inertRoots.set(root, inertRoot);
              // If not contained in the document, it must be in a shadowRoot.
              // Ensure inert styles are added there.
              if (!this._document.body.contains(root)) {
                var parent = root.parentNode;
                while (parent) {
                  if (parent.nodeType === 11) {
                    addInertStyle(parent);
                  }
                  parent = parent.parentNode;
                }
              }
            } else {
              if (!this._inertRoots.has(root)) {
                // element is already non-inert
                return;
              }

              var _inertRoot = this._inertRoots.get(root);
              _inertRoot.destructor();
              this._inertRoots['delete'](root);
              root.removeAttribute('inert');
            }
          }

          /**
           * Get the InertRoot object corresponding to the given inert root element, if any.
           * @param {!Node} element
           * @return {!InertRoot|undefined}
           */

        }, {
          key: 'getInertRoot',
          value: function getInertRoot(element) {
            return this._inertRoots.get(element);
          }

          /**
           * Register the given InertRoot as managing the given node.
           * In the case where the node has a previously existing inert root, this inert root will
           * be added to its set of inert roots.
           * @param {!Node} node
           * @param {!InertRoot} inertRoot
           * @return {!InertNode} inertNode
           */

        }, {
          key: 'register',
          value: function register(node, inertRoot) {
            var inertNode = this._managedNodes.get(node);
            if (inertNode !== undefined) {
              // node was already in an inert subtree
              inertNode.addInertRoot(inertRoot);
            } else {
              inertNode = new InertNode(node, inertRoot);
            }

            this._managedNodes.set(node, inertNode);

            return inertNode;
          }

          /**
           * De-register the given InertRoot as managing the given inert node.
           * Removes the inert root from the InertNode's set of managing inert roots, and remove the inert
           * node from the InertManager's set of managed nodes if it is destroyed.
           * If the node is not currently managed, this is essentially a no-op.
           * @param {!Node} node
           * @param {!InertRoot} inertRoot
           * @return {?InertNode} The potentially destroyed InertNode associated with this node, if any.
           */

        }, {
          key: 'deregister',
          value: function deregister(node, inertRoot) {
            var inertNode = this._managedNodes.get(node);
            if (!inertNode) {
              return null;
            }

            inertNode.removeInertRoot(inertRoot);
            if (inertNode.destroyed) {
              this._managedNodes['delete'](node);
            }

            return inertNode;
          }

          /**
           * Callback used when document has finished loading.
           */

        }, {
          key: '_onDocumentLoaded',
          value: function _onDocumentLoaded() {
            // Find all inert roots in document and make them actually inert.
            var inertElements = slice.call(this._document.querySelectorAll('[inert]'));
            inertElements.forEach(function (inertElement) {
              this.setInert(inertElement, true);
            }, this);

            // Comment this out to use programmatic API only.
            this._observer.observe(this._document.body || this._document.documentElement, { attributes: true, subtree: true, childList: true });
          }

          /**
           * Callback used when mutation observer detects attribute changes.
           * @param {!Array<!MutationRecord>} records
           * @param {!MutationObserver} self
           */

        }, {
          key: '_watchForInert',
          value: function _watchForInert(records, self) {
            var _this = this;
            records.forEach(function (record) {
              switch (record.type) {
                case 'childList':
                  slice.call(record.addedNodes).forEach(function (node) {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                      return;
                    }
                    var inertElements = slice.call(node.querySelectorAll('[inert]'));
                    if (matches.call(node, '[inert]')) {
                      inertElements.unshift(node);
                    }
                    inertElements.forEach(function (inertElement) {
                      this.setInert(inertElement, true);
                    }, _this);
                  }, _this);
                  break;
                case 'attributes':
                  if (record.attributeName !== 'inert') {
                    return;
                  }
                  var target = /** @type {!Element} */record.target;
                  var inert = target.hasAttribute('inert');
                  _this.setInert(target, inert);
                  break;
              }
            }, this);
          }
        }]);

        return InertManager;
      }();

      /**
       * Recursively walk the composed tree from |node|.
       * @param {!Node} node
       * @param {(function (!Element))=} callback Callback to be called for each element traversed,
       *     before descending into child nodes.
       * @param {?ShadowRoot=} shadowRootAncestor The nearest ShadowRoot ancestor, if any.
       */


      function composedTreeWalk(node, callback, shadowRootAncestor) {
        if (node.nodeType == Node.ELEMENT_NODE) {
          var element = /** @type {!Element} */node;
          if (callback) {
            callback(element);
          }

          // Descend into node:
          // If it has a ShadowRoot, ignore all child elements - these will be picked
          // up by the <content> or <shadow> elements. Descend straight into the
          // ShadowRoot.
          var shadowRoot = /** @type {!HTMLElement} */element.shadowRoot;
          if (shadowRoot) {
            composedTreeWalk(shadowRoot, callback);
            return;
          }

          // If it is a <content> element, descend into distributed elements - these
          // are elements from outside the shadow root which are rendered inside the
          // shadow DOM.
          if (element.localName == 'content') {
            var content = /** @type {!HTMLContentElement} */element;
            // Verifies if ShadowDom v0 is supported.
            var distributedNodes = content.getDistributedNodes ? content.getDistributedNodes() : [];
            for (var i = 0; i < distributedNodes.length; i++) {
              composedTreeWalk(distributedNodes[i], callback);
            }
            return;
          }

          // If it is a <slot> element, descend into assigned nodes - these
          // are elements from outside the shadow root which are rendered inside the
          // shadow DOM.
          if (element.localName == 'slot') {
            var slot = /** @type {!HTMLSlotElement} */element;
            // Verify if ShadowDom v1 is supported.
            var _distributedNodes = slot.assignedNodes ? slot.assignedNodes({ flatten: true }) : [];
            for (var _i = 0; _i < _distributedNodes.length; _i++) {
              composedTreeWalk(_distributedNodes[_i], callback);
            }
            return;
          }
        }

        // If it is neither the parent of a ShadowRoot, a <content> element, a <slot>
        // element, nor a <shadow> element recurse normally.
        var child = node.firstChild;
        while (child != null) {
          composedTreeWalk(child, callback);
          child = child.nextSibling;
        }
      }

      /**
       * Adds a style element to the node containing the inert specific styles
       * @param {!Node} node
       */
      function addInertStyle(node) {
        if (node.querySelector('style#inert-style, link#inert-style')) {
          return;
        }
        var style = document.createElement('style');
        style.setAttribute('id', 'inert-style');
        style.textContent = '\n' + '[inert] {\n' + '  pointer-events: none;\n' + '  cursor: default;\n' + '}\n' + '\n' + '[inert], [inert] * {\n' + '  -webkit-user-select: none;\n' + '  -moz-user-select: none;\n' + '  -ms-user-select: none;\n' + '  user-select: none;\n' + '}\n';
        node.appendChild(style);
      }

      /** @type {!InertManager} */
      var inertManager = new InertManager(document);

      if (!Element.prototype.hasOwnProperty('inert')) {
        Object.defineProperty(Element.prototype, 'inert', {
          enumerable: true,
          /** @this {!Element} */
          get: function get() {
            return this.hasAttribute('inert');
          },
          /** @this {!Element} */
          set: function set(inert) {
            inertManager.setInert(this, inert);
          }
        });
      }
    })();

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$1 = {
        CLOSING: 'mdc-dialog--closing',
        OPEN: 'mdc-dialog--open',
        OPENING: 'mdc-dialog--opening',
        SCROLLABLE: 'mdc-dialog--scrollable',
        SCROLL_LOCK: 'mdc-dialog-scroll-lock',
        STACKED: 'mdc-dialog--stacked',
    };
    var strings$1 = {
        ACTION_ATTRIBUTE: 'data-mdc-dialog-action',
        BUTTON_DEFAULT_ATTRIBUTE: 'data-mdc-dialog-button-default',
        BUTTON_SELECTOR: '.mdc-dialog__button',
        CLOSED_EVENT: 'MDCDialog:closed',
        CLOSE_ACTION: 'close',
        CLOSING_EVENT: 'MDCDialog:closing',
        CONTAINER_SELECTOR: '.mdc-dialog__container',
        CONTENT_SELECTOR: '.mdc-dialog__content',
        DESTROY_ACTION: 'destroy',
        INITIAL_FOCUS_ATTRIBUTE: 'data-mdc-dialog-initial-focus',
        OPENED_EVENT: 'MDCDialog:opened',
        OPENING_EVENT: 'MDCDialog:opening',
        SCRIM_SELECTOR: '.mdc-dialog__scrim',
        SUPPRESS_DEFAULT_PRESS_SELECTOR: [
            'textarea',
            '.mdc-menu .mdc-list-item',
        ].join(', '),
        SURFACE_SELECTOR: '.mdc-dialog__surface',
    };
    var numbers$1 = {
        DIALOG_ANIMATION_CLOSE_TIME_MS: 75,
        DIALOG_ANIMATION_OPEN_TIME_MS: 150,
    };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$1 = function(d, b) {
        extendStatics$1 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$1(d, b);
    };

    function __extends$1(d, b) {
        extendStatics$1(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$1 = function() {
        __assign$1 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$1.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCDialogFoundation = /** @class */ (function (_super) {
        __extends$1(MDCDialogFoundation, _super);
        function MDCDialogFoundation(adapter) {
            var _this = _super.call(this, __assign$1(__assign$1({}, MDCDialogFoundation.defaultAdapter), adapter)) || this;
            _this.isOpen_ = false;
            _this.animationFrame_ = 0;
            _this.animationTimer_ = 0;
            _this.layoutFrame_ = 0;
            _this.escapeKeyAction_ = strings$1.CLOSE_ACTION;
            _this.scrimClickAction_ = strings$1.CLOSE_ACTION;
            _this.autoStackButtons_ = true;
            _this.areButtonsStacked_ = false;
            _this.suppressDefaultPressSelector = strings$1.SUPPRESS_DEFAULT_PRESS_SELECTOR;
            return _this;
        }
        Object.defineProperty(MDCDialogFoundation, "cssClasses", {
            get: function () {
                return cssClasses$1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCDialogFoundation, "strings", {
            get: function () {
                return strings$1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCDialogFoundation, "numbers", {
            get: function () {
                return numbers$1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCDialogFoundation, "defaultAdapter", {
            get: function () {
                return {
                    addBodyClass: function () { return undefined; },
                    addClass: function () { return undefined; },
                    areButtonsStacked: function () { return false; },
                    clickDefaultButton: function () { return undefined; },
                    eventTargetMatches: function () { return false; },
                    getActionFromEvent: function () { return ''; },
                    getInitialFocusEl: function () { return null; },
                    hasClass: function () { return false; },
                    isContentScrollable: function () { return false; },
                    notifyClosed: function () { return undefined; },
                    notifyClosing: function () { return undefined; },
                    notifyOpened: function () { return undefined; },
                    notifyOpening: function () { return undefined; },
                    releaseFocus: function () { return undefined; },
                    removeBodyClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    reverseButtons: function () { return undefined; },
                    trapFocus: function () { return undefined; },
                };
            },
            enumerable: true,
            configurable: true
        });
        MDCDialogFoundation.prototype.init = function () {
            if (this.adapter.hasClass(cssClasses$1.STACKED)) {
                this.setAutoStackButtons(false);
            }
        };
        MDCDialogFoundation.prototype.destroy = function () {
            if (this.isOpen_) {
                this.close(strings$1.DESTROY_ACTION);
            }
            if (this.animationTimer_) {
                clearTimeout(this.animationTimer_);
                this.handleAnimationTimerEnd_();
            }
            if (this.layoutFrame_) {
                cancelAnimationFrame(this.layoutFrame_);
                this.layoutFrame_ = 0;
            }
        };
        MDCDialogFoundation.prototype.open = function () {
            var _this = this;
            this.isOpen_ = true;
            this.adapter.notifyOpening();
            this.adapter.addClass(cssClasses$1.OPENING);
            // Wait a frame once display is no longer "none", to establish basis for animation
            this.runNextAnimationFrame_(function () {
                _this.adapter.addClass(cssClasses$1.OPEN);
                _this.adapter.addBodyClass(cssClasses$1.SCROLL_LOCK);
                _this.layout();
                _this.animationTimer_ = setTimeout(function () {
                    _this.handleAnimationTimerEnd_();
                    _this.adapter.trapFocus(_this.adapter.getInitialFocusEl());
                    _this.adapter.notifyOpened();
                }, numbers$1.DIALOG_ANIMATION_OPEN_TIME_MS);
            });
        };
        MDCDialogFoundation.prototype.close = function (action) {
            var _this = this;
            if (action === void 0) { action = ''; }
            if (!this.isOpen_) {
                // Avoid redundant close calls (and events), e.g. from keydown on elements that inherently emit click
                return;
            }
            this.isOpen_ = false;
            this.adapter.notifyClosing(action);
            this.adapter.addClass(cssClasses$1.CLOSING);
            this.adapter.removeClass(cssClasses$1.OPEN);
            this.adapter.removeBodyClass(cssClasses$1.SCROLL_LOCK);
            cancelAnimationFrame(this.animationFrame_);
            this.animationFrame_ = 0;
            clearTimeout(this.animationTimer_);
            this.animationTimer_ = setTimeout(function () {
                _this.adapter.releaseFocus();
                _this.handleAnimationTimerEnd_();
                _this.adapter.notifyClosed(action);
            }, numbers$1.DIALOG_ANIMATION_CLOSE_TIME_MS);
        };
        MDCDialogFoundation.prototype.isOpen = function () {
            return this.isOpen_;
        };
        MDCDialogFoundation.prototype.getEscapeKeyAction = function () {
            return this.escapeKeyAction_;
        };
        MDCDialogFoundation.prototype.setEscapeKeyAction = function (action) {
            this.escapeKeyAction_ = action;
        };
        MDCDialogFoundation.prototype.getScrimClickAction = function () {
            return this.scrimClickAction_;
        };
        MDCDialogFoundation.prototype.setScrimClickAction = function (action) {
            this.scrimClickAction_ = action;
        };
        MDCDialogFoundation.prototype.getAutoStackButtons = function () {
            return this.autoStackButtons_;
        };
        MDCDialogFoundation.prototype.setAutoStackButtons = function (autoStack) {
            this.autoStackButtons_ = autoStack;
        };
        MDCDialogFoundation.prototype.getSuppressDefaultPressSelector = function () {
            return this.suppressDefaultPressSelector;
        };
        MDCDialogFoundation.prototype.setSuppressDefaultPressSelector = function (selector) {
            this.suppressDefaultPressSelector = selector;
        };
        MDCDialogFoundation.prototype.layout = function () {
            var _this = this;
            if (this.layoutFrame_) {
                cancelAnimationFrame(this.layoutFrame_);
            }
            this.layoutFrame_ = requestAnimationFrame(function () {
                _this.layoutInternal_();
                _this.layoutFrame_ = 0;
            });
        };
        /** Handles click on the dialog root element. */
        MDCDialogFoundation.prototype.handleClick = function (evt) {
            var isScrim = this.adapter.eventTargetMatches(evt.target, strings$1.SCRIM_SELECTOR);
            // Check for scrim click first since it doesn't require querying ancestors.
            if (isScrim && this.scrimClickAction_ !== '') {
                this.close(this.scrimClickAction_);
            }
            else {
                var action = this.adapter.getActionFromEvent(evt);
                if (action) {
                    this.close(action);
                }
            }
        };
        /** Handles keydown on the dialog root element. */
        MDCDialogFoundation.prototype.handleKeydown = function (evt) {
            var isEnter = evt.key === 'Enter' || evt.keyCode === 13;
            if (!isEnter) {
                return;
            }
            var action = this.adapter.getActionFromEvent(evt);
            if (action) {
                // Action button callback is handled in `handleClick`,
                // since space/enter keydowns on buttons trigger click events.
                return;
            }
            // `composedPath` is used here, when available, to account for use cases
            // where a target meant to suppress the default press behaviour
            // may exist in a shadow root.
            // For example, a textarea inside a web component:
            // <mwc-dialog>
            //   <horizontal-layout>
            //     #shadow-root (open)
            //       <mwc-textarea>
            //         #shadow-root (open)
            //           <textarea></textarea>
            //       </mwc-textarea>
            //   </horizontal-layout>
            // </mwc-dialog>
            var target = evt.composedPath ? evt.composedPath()[0] : evt.target;
            var isDefault = !this.adapter.eventTargetMatches(target, this.suppressDefaultPressSelector);
            if (isEnter && isDefault) {
                this.adapter.clickDefaultButton();
            }
        };
        /** Handles keydown on the document. */
        MDCDialogFoundation.prototype.handleDocumentKeydown = function (evt) {
            var isEscape = evt.key === 'Escape' || evt.keyCode === 27;
            if (isEscape && this.escapeKeyAction_ !== '') {
                this.close(this.escapeKeyAction_);
            }
        };
        MDCDialogFoundation.prototype.layoutInternal_ = function () {
            if (this.autoStackButtons_) {
                this.detectStackedButtons_();
            }
            this.detectScrollableContent_();
        };
        MDCDialogFoundation.prototype.handleAnimationTimerEnd_ = function () {
            this.animationTimer_ = 0;
            this.adapter.removeClass(cssClasses$1.OPENING);
            this.adapter.removeClass(cssClasses$1.CLOSING);
        };
        /**
         * Runs the given logic on the next animation frame, using setTimeout to factor in Firefox reflow behavior.
         */
        MDCDialogFoundation.prototype.runNextAnimationFrame_ = function (callback) {
            var _this = this;
            cancelAnimationFrame(this.animationFrame_);
            this.animationFrame_ = requestAnimationFrame(function () {
                _this.animationFrame_ = 0;
                clearTimeout(_this.animationTimer_);
                _this.animationTimer_ = setTimeout(callback, 0);
            });
        };
        MDCDialogFoundation.prototype.detectStackedButtons_ = function () {
            // Remove the class first to let us measure the buttons' natural positions.
            this.adapter.removeClass(cssClasses$1.STACKED);
            var areButtonsStacked = this.adapter.areButtonsStacked();
            if (areButtonsStacked) {
                this.adapter.addClass(cssClasses$1.STACKED);
            }
            if (areButtonsStacked !== this.areButtonsStacked_) {
                this.adapter.reverseButtons();
                this.areButtonsStacked_ = areButtonsStacked;
            }
        };
        MDCDialogFoundation.prototype.detectScrollableContent_ = function () {
            // Remove the class first to let us measure the natural height of the content.
            this.adapter.removeClass(cssClasses$1.SCROLLABLE);
            if (this.adapter.isContentScrollable()) {
                this.adapter.addClass(cssClasses$1.SCROLLABLE);
            }
        };
        return MDCDialogFoundation;
    }(MDCFoundation));

    /**
     * @license
     * Copyright 2019 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    /**
     * Determine whether the current browser supports passive event listeners, and
     * if so, use them.
     */
    function applyPassive(globalObj) {
        if (globalObj === void 0) { globalObj = window; }
        return supportsPassiveOption(globalObj) ?
            { passive: true } :
            false;
    }
    function supportsPassiveOption(globalObj) {
        if (globalObj === void 0) { globalObj = window; }
        // See
        // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
        var passiveSupported = false;
        try {
            var options = {
                // This function will be called when the browser
                // attempts to access the passive property.
                get passive() {
                    passiveSupported = true;
                    return false;
                }
            };
            var handler = function () { };
            globalObj.document.addEventListener('test', handler, options);
            globalObj.document.removeEventListener('test', handler, options);
        }
        catch (err) {
            passiveSupported = false;
        }
        return passiveSupported;
    }

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */ // tslint:disable:no-any
    /**
     * Specifies an observer callback that is run when the decorated property
     * changes. The observer receives the current and old value as arguments.
     */
    const observer = (observer) => 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (proto, propName) => {
        // if we haven't wrapped `updated` in this class, do so
        if (!proto.constructor
            ._observers) {
            proto.constructor._observers = new Map();
            const userUpdated = proto.updated;
            proto.updated = function (changedProperties) {
                userUpdated.call(this, changedProperties);
                changedProperties.forEach((v, k) => {
                    const observers = this.constructor
                        ._observers;
                    const observer = observers.get(k);
                    if (observer !== undefined) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        observer.call(this, this[k], v);
                    }
                });
            };
            // clone any existing observers (superclasses)
            // eslint-disable-next-line no-prototype-builtins
        }
        else if (!proto.constructor.hasOwnProperty('_observers')) {
            const observers = proto.constructor._observers;
            proto.constructor._observers = new Map();
            observers.forEach(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (v, k) => proto.constructor._observers.set(k, v));
        }
        // set this method
        proto.constructor._observers.set(propName, observer);
    };

    const blockingElements = document.$blockingElements;
    class DialogBase extends BaseElement {
        constructor() {
            super(...arguments);
            this.hideActions = false;
            this.stacked = false;
            this.heading = '';
            this.scrimClickAction = 'close';
            this.escapeKeyAction = 'close';
            this.open = false;
            this.defaultAction = 'close';
            this.actionAttribute = 'dialogAction';
            this.initialFocusAttribute = 'dialogInitialFocus';
            this.mdcFoundationClass = MDCDialogFoundation;
            this.boundLayout = null;
            this.boundHandleClick = null;
            this.boundHandleKeydown = null;
            this.boundHandleDocumentKeydown = null;
        }
        get primaryButton() {
            let assignedNodes = this.primarySlot.assignedNodes();
            assignedNodes = assignedNodes.filter((node) => node instanceof HTMLElement);
            const button = assignedNodes[0];
            return button ? button : null;
        }
        emitNotification(name, action) {
            const init = { detail: action ? { action } : {} };
            const ev = new CustomEvent(name, init);
            this.dispatchEvent(ev);
        }
        getInitialFocusEl() {
            const initFocusSelector = `[${this.initialFocusAttribute}]`;
            // only search light DOM. This typically handles all the cases
            const lightDomQs = this.querySelector(initFocusSelector);
            if (lightDomQs) {
                return lightDomQs;
            }
            // if not in light dom, search each flattened distributed node.
            const primarySlot = this.primarySlot;
            const primaryNodes = primarySlot.assignedNodes({ flatten: true });
            const primaryFocusElement = this.searchNodeTreesForAttribute(primaryNodes, this.initialFocusAttribute);
            if (primaryFocusElement) {
                return primaryFocusElement;
            }
            const secondarySlot = this.secondarySlot;
            const secondaryNodes = secondarySlot.assignedNodes({ flatten: true });
            const secondaryFocusElement = this.searchNodeTreesForAttribute(secondaryNodes, this.initialFocusAttribute);
            if (secondaryFocusElement) {
                return secondaryFocusElement;
            }
            const contentSlot = this.contentSlot;
            const contentNodes = contentSlot.assignedNodes({ flatten: true });
            const initFocusElement = this.searchNodeTreesForAttribute(contentNodes, this.initialFocusAttribute);
            return initFocusElement;
        }
        searchNodeTreesForAttribute(nodes, attribute) {
            for (const node of nodes) {
                if (!(node instanceof HTMLElement)) {
                    continue;
                }
                if (node.hasAttribute(attribute)) {
                    return node;
                }
                else {
                    const selection = node.querySelector(`[${attribute}]`);
                    if (selection) {
                        return selection;
                    }
                }
            }
            return null;
        }
        createAdapter() {
            return Object.assign(Object.assign({}, addHasRemoveClass(this.mdcRoot)), { addBodyClass: () => document.body.style.overflow = 'hidden', removeBodyClass: () => document.body.style.overflow = '', areButtonsStacked: () => this.stacked, clickDefaultButton: () => {
                    const primary = this.primaryButton;
                    if (primary) {
                        primary.click();
                    }
                }, eventTargetMatches: (target, selector) => target ? matches(target, selector) : false, getActionFromEvent: (e) => {
                    if (!e.target) {
                        return '';
                    }
                    const element = closest(e.target, `[${this.actionAttribute}]`);
                    const action = element && element.getAttribute(this.actionAttribute);
                    return action;
                }, getInitialFocusEl: () => {
                    return this.getInitialFocusEl();
                }, isContentScrollable: () => {
                    const el = this.contentElement;
                    return el ? el.scrollHeight > el.offsetHeight : false;
                }, notifyClosed: (action) => this.emitNotification('closed', action), notifyClosing: (action) => {
                    if (!this.closingDueToDisconnect) {
                        // Don't set our open state to closed just because we were
                        // disconnected. That way if we get reconnected, we'll know to
                        // re-open.
                        this.open = false;
                    }
                    this.emitNotification('closing', action);
                }, notifyOpened: () => this.emitNotification('opened'), notifyOpening: () => {
                    this.open = true;
                    this.emitNotification('opening');
                }, reverseButtons: () => { }, releaseFocus: () => {
                    blockingElements.remove(this);
                }, trapFocus: (el) => {
                    blockingElements.push(this);
                    if (el) {
                        el.focus();
                    }
                } });
        }
        render() {
            const classes = {
                [cssClasses$1.STACKED]: this.stacked,
            };
            let heading = html ``;
            if (this.heading) {
                heading = this.renderHeading();
            }
            const actionsClasses = {
                'mdc-dialog__actions': !this.hideActions,
            };
            return html `
    <div class="mdc-dialog ${classMap(classes)}"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="title"
        aria-describedby="content">
      <div class="mdc-dialog__container">
        <div class="mdc-dialog__surface">
          ${heading}
          <div id="content" class="mdc-dialog__content">
            <slot id="contentSlot"></slot>
          </div>
          <footer
              id="actions"
              class="${classMap(actionsClasses)}">
            <span>
              <slot name="secondaryAction"></slot>
            </span>
            <span>
             <slot name="primaryAction"></slot>
            </span>
          </footer>
        </div>
      </div>
      <div class="mdc-dialog__scrim"></div>
    </div>`;
        }
        renderHeading() {
            return html `
      <h2 id="title" class="mdc-dialog__title">${this.heading}</h2>`;
        }
        firstUpdated() {
            super.firstUpdated();
            this.mdcFoundation.setAutoStackButtons(true);
        }
        connectedCallback() {
            super.connectedCallback();
            if (this.open && this.mdcFoundation && !this.mdcFoundation.isOpen()) {
                // We probably got disconnected while we were still open. Re-open,
                // matching the behavior of native <dialog>.
                this.setEventListeners();
                this.mdcFoundation.open();
            }
        }
        disconnectedCallback() {
            super.disconnectedCallback();
            if (this.open && this.mdcFoundation) {
                // If this dialog is opened and then disconnected, we want to close
                // the foundation, so that 1) any pending timers are cancelled
                // (in particular for trapFocus), and 2) if we reconnect, we can open
                // the foundation again to retrigger animations and focus.
                this.removeEventListeners();
                this.closingDueToDisconnect = true;
                this.mdcFoundation.close(this.currentAction || this.defaultAction);
                this.closingDueToDisconnect = false;
                this.currentAction = undefined;
                // When we close normally, the releaseFocus callback handles removing
                // ourselves from the blocking elements stack. However, that callback
                // happens on a delay, and when we are closing due to a disconnect we
                // need to remove ourselves before the blocking element polyfill's
                // mutation observer notices and logs a warning, since it's not valid to
                // be in the blocking elements stack while disconnected.
                blockingElements.remove(this);
            }
        }
        forceLayout() {
            this.mdcFoundation.layout();
        }
        focus() {
            const initialFocusEl = this.getInitialFocusEl();
            initialFocusEl && initialFocusEl.focus();
        }
        blur() {
            if (!this.shadowRoot) {
                return;
            }
            const activeEl = this.shadowRoot.activeElement;
            if (activeEl) {
                if (activeEl instanceof HTMLElement) {
                    activeEl.blur();
                }
            }
            else {
                const root = this.getRootNode();
                const activeEl = root instanceof Document ? root.activeElement : null;
                if (activeEl instanceof HTMLElement) {
                    activeEl.blur();
                }
            }
        }
        setEventListeners() {
            this.boundHandleClick = this.mdcFoundation.handleClick.bind(this.mdcFoundation);
            this.boundLayout = () => {
                if (this.open) {
                    this.mdcFoundation.layout.bind(this.mdcFoundation);
                }
            };
            this.boundHandleKeydown = this.mdcFoundation.handleKeydown.bind(this.mdcFoundation);
            this.boundHandleDocumentKeydown =
                this.mdcFoundation.handleDocumentKeydown.bind(this.mdcFoundation);
            this.mdcRoot.addEventListener('click', this.boundHandleClick);
            window.addEventListener('resize', this.boundLayout, applyPassive());
            window.addEventListener('orientationchange', this.boundLayout, applyPassive());
            this.mdcRoot.addEventListener('keydown', this.boundHandleKeydown, applyPassive());
            document.addEventListener('keydown', this.boundHandleDocumentKeydown, applyPassive());
        }
        removeEventListeners() {
            if (this.boundHandleClick) {
                this.mdcRoot.removeEventListener('click', this.boundHandleClick);
            }
            if (this.boundLayout) {
                window.removeEventListener('resize', this.boundLayout);
                window.removeEventListener('orientationchange', this.boundLayout);
            }
            if (this.boundHandleKeydown) {
                this.mdcRoot.removeEventListener('keydown', this.boundHandleKeydown);
            }
            if (this.boundHandleDocumentKeydown) {
                this.mdcRoot.removeEventListener('keydown', this.boundHandleDocumentKeydown);
            }
        }
        close() {
            this.open = false;
        }
        show() {
            this.open = true;
        }
    }
    __decorate([
        query('.mdc-dialog')
    ], DialogBase.prototype, "mdcRoot", void 0);
    __decorate([
        query('slot[name="primaryAction"]')
    ], DialogBase.prototype, "primarySlot", void 0);
    __decorate([
        query('slot[name="secondaryAction"]')
    ], DialogBase.prototype, "secondarySlot", void 0);
    __decorate([
        query('#contentSlot')
    ], DialogBase.prototype, "contentSlot", void 0);
    __decorate([
        query('.mdc-dialog__content')
    ], DialogBase.prototype, "contentElement", void 0);
    __decorate([
        query('.mdc-container')
    ], DialogBase.prototype, "conatinerElement", void 0);
    __decorate([
        property({ type: Boolean })
    ], DialogBase.prototype, "hideActions", void 0);
    __decorate([
        property({ type: Boolean }),
        observer(function () {
            this.forceLayout();
        })
    ], DialogBase.prototype, "stacked", void 0);
    __decorate([
        property({ type: String })
    ], DialogBase.prototype, "heading", void 0);
    __decorate([
        property({ type: String }),
        observer(function (newAction) {
            this.mdcFoundation.setScrimClickAction(newAction);
        })
    ], DialogBase.prototype, "scrimClickAction", void 0);
    __decorate([
        property({ type: String }),
        observer(function (newAction) {
            this.mdcFoundation.setEscapeKeyAction(newAction);
        })
    ], DialogBase.prototype, "escapeKeyAction", void 0);
    __decorate([
        property({ type: Boolean, reflect: true }),
        observer(function (isOpen) {
            // Check isConnected because we could have been disconnected before first
            // update. If we're now closed, then we shouldn't start the MDC foundation
            // opening animation. If we're now closed, then we've already closed the
            // foundation in disconnectedCallback.
            if (this.mdcFoundation && this.isConnected) {
                if (isOpen) {
                    this.setEventListeners();
                    this.mdcFoundation.open();
                }
                else {
                    this.removeEventListeners();
                    this.mdcFoundation.close(this.currentAction || this.defaultAction);
                    this.currentAction = undefined;
                }
            }
        })
    ], DialogBase.prototype, "open", void 0);
    __decorate([
        property()
    ], DialogBase.prototype, "defaultAction", void 0);
    __decorate([
        property()
    ], DialogBase.prototype, "actionAttribute", void 0);
    __decorate([
        property()
    ], DialogBase.prototype, "initialFocusAttribute", void 0);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$4 = css `.mdc-elevation-overlay{position:absolute;border-radius:inherit;pointer-events:none;opacity:0;opacity:var(--mdc-elevation-overlay-opacity, 0);transition:opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);background-color:#fff;background-color:var(--mdc-elevation-overlay-color, #fff)}.mdc-dialog,.mdc-dialog__scrim{position:fixed;top:0;left:0;align-items:center;justify-content:center;box-sizing:border-box;width:100%;height:100%}.mdc-dialog{display:none;z-index:7}.mdc-dialog .mdc-dialog__surface{background-color:#fff;background-color:var(--mdc-theme-surface, #fff)}.mdc-dialog .mdc-dialog__scrim{background-color:rgba(0,0,0,.32)}.mdc-dialog .mdc-dialog__title{color:rgba(0,0,0,.87)}.mdc-dialog .mdc-dialog__content{color:rgba(0,0,0,.6)}.mdc-dialog.mdc-dialog--scrollable .mdc-dialog__title,.mdc-dialog.mdc-dialog--scrollable .mdc-dialog__actions{border-color:rgba(0,0,0,.12)}.mdc-dialog .mdc-dialog__content{padding:20px 24px 20px 24px}.mdc-dialog .mdc-dialog__surface{min-width:280px}@media(max-width: 592px){.mdc-dialog .mdc-dialog__surface{max-width:calc(100vw - 32px)}}@media(min-width: 592px){.mdc-dialog .mdc-dialog__surface{max-width:560px}}.mdc-dialog .mdc-dialog__surface{max-height:calc(100% - 32px)}.mdc-dialog .mdc-dialog__surface{border-radius:4px;border-radius:var(--mdc-shape-medium, 4px)}.mdc-dialog__scrim{opacity:0;z-index:-1}.mdc-dialog__container{display:flex;flex-direction:row;align-items:center;justify-content:space-around;box-sizing:border-box;height:100%;transform:scale(0.8);opacity:0;pointer-events:none}.mdc-dialog__surface{position:relative;box-shadow:0px 11px 15px -7px rgba(0, 0, 0, 0.2),0px 24px 38px 3px rgba(0, 0, 0, 0.14),0px 9px 46px 8px rgba(0,0,0,.12);display:flex;flex-direction:column;flex-grow:0;flex-shrink:0;box-sizing:border-box;max-width:100%;max-height:100%;pointer-events:auto;overflow-y:auto}.mdc-dialog__surface .mdc-elevation-overlay{width:100%;height:100%;top:0;left:0}.mdc-dialog[dir=rtl] .mdc-dialog__surface,[dir=rtl] .mdc-dialog .mdc-dialog__surface{text-align:right}.mdc-dialog__title{display:block;margin-top:0;line-height:normal;-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-headline6-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:1.25rem;font-size:var(--mdc-typography-headline6-font-size, 1.25rem);line-height:2rem;line-height:var(--mdc-typography-headline6-line-height, 2rem);font-weight:500;font-weight:var(--mdc-typography-headline6-font-weight, 500);letter-spacing:0.0125em;letter-spacing:var(--mdc-typography-headline6-letter-spacing, 0.0125em);text-decoration:inherit;text-decoration:var(--mdc-typography-headline6-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-headline6-text-transform, inherit);position:relative;flex-shrink:0;box-sizing:border-box;margin:0;padding:0 24px 9px;border-bottom:1px solid transparent}.mdc-dialog__title::before{display:inline-block;width:0;height:40px;content:"";vertical-align:0}.mdc-dialog[dir=rtl] .mdc-dialog__title,[dir=rtl] .mdc-dialog .mdc-dialog__title{text-align:right}.mdc-dialog--scrollable .mdc-dialog__title{padding-bottom:15px}.mdc-dialog__content{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-body1-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:1rem;font-size:var(--mdc-typography-body1-font-size, 1rem);line-height:1.5rem;line-height:var(--mdc-typography-body1-line-height, 1.5rem);font-weight:400;font-weight:var(--mdc-typography-body1-font-weight, 400);letter-spacing:0.03125em;letter-spacing:var(--mdc-typography-body1-letter-spacing, 0.03125em);text-decoration:inherit;text-decoration:var(--mdc-typography-body1-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-body1-text-transform, inherit);flex-grow:1;box-sizing:border-box;margin:0;overflow:auto;-webkit-overflow-scrolling:touch}.mdc-dialog__content>:first-child{margin-top:0}.mdc-dialog__content>:last-child{margin-bottom:0}.mdc-dialog__title+.mdc-dialog__content{padding-top:0}.mdc-dialog--scrollable .mdc-dialog__title+.mdc-dialog__content{padding-top:8px;padding-bottom:8px}.mdc-dialog__content .mdc-list:first-child:last-child{padding:6px 0 0}.mdc-dialog--scrollable .mdc-dialog__content .mdc-list:first-child:last-child{padding:0}.mdc-dialog__actions{display:flex;position:relative;flex-shrink:0;flex-wrap:wrap;align-items:center;justify-content:flex-end;box-sizing:border-box;min-height:52px;margin:0;padding:8px;border-top:1px solid transparent}.mdc-dialog--stacked .mdc-dialog__actions{flex-direction:column;align-items:flex-end}.mdc-dialog__button{margin-left:8px;margin-right:0;max-width:100%;text-align:right}[dir=rtl] .mdc-dialog__button,.mdc-dialog__button[dir=rtl]{margin-left:0;margin-right:8px}.mdc-dialog__button:first-child{margin-left:0;margin-right:0}[dir=rtl] .mdc-dialog__button:first-child,.mdc-dialog__button:first-child[dir=rtl]{margin-left:0;margin-right:0}.mdc-dialog[dir=rtl] .mdc-dialog__button,[dir=rtl] .mdc-dialog .mdc-dialog__button{text-align:left}.mdc-dialog--stacked .mdc-dialog__button:not(:first-child){margin-top:12px}.mdc-dialog--open,.mdc-dialog--opening,.mdc-dialog--closing{display:flex}.mdc-dialog--opening .mdc-dialog__scrim{transition:opacity 150ms linear}.mdc-dialog--opening .mdc-dialog__container{transition:opacity 75ms linear,transform 150ms 0ms cubic-bezier(0, 0, 0.2, 1)}.mdc-dialog--closing .mdc-dialog__scrim,.mdc-dialog--closing .mdc-dialog__container{transition:opacity 75ms linear}.mdc-dialog--closing .mdc-dialog__container{transform:none}.mdc-dialog--open .mdc-dialog__scrim{opacity:1}.mdc-dialog--open .mdc-dialog__container{transform:none;opacity:1}.mdc-dialog-scroll-lock{overflow:hidden}#actions:not(.mdc-dialog__actions){display:none}.mdc-dialog__surface{box-shadow:var(--mdc-dialog-box-shadow, 0px 11px 15px -7px rgba(0, 0, 0, 0.2), 0px 24px 38px 3px rgba(0, 0, 0, 0.14), 0px 9px 46px 8px rgba(0, 0, 0, 0.12))}@media(min-width: 560px){.mdc-dialog .mdc-dialog__surface{max-width:560px;max-width:var(--mdc-dialog-max-width, 560px)}}.mdc-dialog .mdc-dialog__scrim{background-color:rgba(0, 0, 0, 0.32);background-color:var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.32))}.mdc-dialog .mdc-dialog__title{color:rgba(0, 0, 0, 0.87);color:var(--mdc-dialog-heading-ink-color, rgba(0, 0, 0, 0.87))}.mdc-dialog .mdc-dialog__content{color:rgba(0, 0, 0, 0.6);color:var(--mdc-dialog-content-ink-color, rgba(0, 0, 0, 0.6))}.mdc-dialog.mdc-dialog--scrollable .mdc-dialog__title,.mdc-dialog.mdc-dialog--scrollable .mdc-dialog__actions{border-color:rgba(0, 0, 0, 0.12);border-color:var(--mdc-dialog-scroll-divider-color, rgba(0, 0, 0, 0.12))}.mdc-dialog .mdc-dialog__surface{min-width:280px;min-width:var(--mdc-dialog-min-width, 280px)}.mdc-dialog .mdc-dialog__surface{max-height:var(--mdc-dialog-max-height, calc(100% - 32px))}#actions ::slotted(*){margin-left:8px;margin-right:0;max-width:100%;text-align:right}[dir=rtl] #actions ::slotted(*),#actions ::slotted(*)[dir=rtl]{margin-left:0;margin-right:8px}.mdc-dialog[dir=rtl] #actions ::slotted(*),[dir=rtl] .mdc-dialog #actions ::slotted(*){text-align:left}.mdc-dialog--stacked #actions{flex-direction:column-reverse}.mdc-dialog--stacked #actions *:not(:last-child) ::slotted(*){flex-basis:1e-9px;margin-top:12px}`;

    let Dialog = class Dialog extends DialogBase {
    };
    Dialog.styles = style$4;
    Dialog = __decorate([
        customElement('mwc-dialog')
    ], Dialog);

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$2 = function(d, b) {
        extendStatics$2 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$2(d, b);
    };

    function __extends$2(d, b) {
        extendStatics$2(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$2 = function() {
        __assign$2 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$2.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$2 = {
        ROOT: 'mdc-form-field',
    };
    var strings$2 = {
        LABEL_SELECTOR: '.mdc-form-field > label',
    };

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFormFieldFoundation = /** @class */ (function (_super) {
        __extends$2(MDCFormFieldFoundation, _super);
        function MDCFormFieldFoundation(adapter) {
            var _this = _super.call(this, __assign$2(__assign$2({}, MDCFormFieldFoundation.defaultAdapter), adapter)) || this;
            _this.click = function () {
                _this.handleClick();
            };
            return _this;
        }
        Object.defineProperty(MDCFormFieldFoundation, "cssClasses", {
            get: function () {
                return cssClasses$2;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFormFieldFoundation, "strings", {
            get: function () {
                return strings$2;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFormFieldFoundation, "defaultAdapter", {
            get: function () {
                return {
                    activateInputRipple: function () { return undefined; },
                    deactivateInputRipple: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                    registerInteractionHandler: function () { return undefined; },
                };
            },
            enumerable: true,
            configurable: true
        });
        MDCFormFieldFoundation.prototype.init = function () {
            this.adapter.registerInteractionHandler('click', this.click);
        };
        MDCFormFieldFoundation.prototype.destroy = function () {
            this.adapter.deregisterInteractionHandler('click', this.click);
        };
        MDCFormFieldFoundation.prototype.handleClick = function () {
            var _this = this;
            this.adapter.activateInputRipple();
            requestAnimationFrame(function () {
                _this.adapter.deactivateInputRipple();
            });
        };
        return MDCFormFieldFoundation;
    }(MDCFoundation));

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    /** @soyCompatible */
    class FormElement extends BaseElement {
        createRenderRoot() {
            return this.attachShadow({ mode: 'open', delegatesFocus: true });
        }
        click() {
            if (this.formElement) {
                this.formElement.focus();
                this.formElement.click();
            }
        }
        setAriaLabel(label) {
            if (this.formElement) {
                this.formElement.setAttribute('aria-label', label);
            }
        }
        firstUpdated() {
            super.firstUpdated();
            this.mdcRoot.addEventListener('change', (e) => {
                this.dispatchEvent(new Event('change', e));
            });
        }
    }

    /**
     * @license
     * Copyright 2018 Google Inc. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *     http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    class FormfieldBase extends BaseElement {
        constructor() {
            super(...arguments);
            this.alignEnd = false;
            this.spaceBetween = false;
            this.nowrap = false;
            this.label = '';
            this.mdcFoundationClass = MDCFormFieldFoundation;
        }
        createAdapter() {
            return {
                registerInteractionHandler: (type, handler) => {
                    this.labelEl.addEventListener(type, handler);
                },
                deregisterInteractionHandler: (type, handler) => {
                    this.labelEl.removeEventListener(type, handler);
                },
                activateInputRipple: async () => {
                    const input = this.input;
                    if (input instanceof FormElement) {
                        const ripple = await input.ripple;
                        if (ripple) {
                            ripple.startPress();
                        }
                    }
                },
                deactivateInputRipple: async () => {
                    const input = this.input;
                    if (input instanceof FormElement) {
                        const ripple = await input.ripple;
                        if (ripple) {
                            ripple.endPress();
                        }
                    }
                },
            };
        }
        get input() {
            return findAssignedElement(this.slotEl, '*');
        }
        render() {
            const classes = {
                'mdc-form-field--align-end': this.alignEnd,
                'mdc-form-field--space-between': this.spaceBetween,
                'mdc-form-field--nowrap': this.nowrap
            };
            return html `
      <div class="mdc-form-field ${classMap(classes)}">
        <slot></slot>
        <label class="mdc-label"
               @click="${this._labelClick}">${this.label}</label>
      </div>`;
        }
        _labelClick() {
            const input = this.input;
            if (input) {
                input.focus();
                input.click();
            }
        }
    }
    __decorate([
        property({ type: Boolean })
    ], FormfieldBase.prototype, "alignEnd", void 0);
    __decorate([
        property({ type: Boolean })
    ], FormfieldBase.prototype, "spaceBetween", void 0);
    __decorate([
        property({ type: Boolean })
    ], FormfieldBase.prototype, "nowrap", void 0);
    __decorate([
        property({ type: String }),
        observer(async function (label) {
            const input = this.input;
            if (input) {
                if (input.localName === 'input') {
                    input.setAttribute('aria-label', label);
                }
                else if (input instanceof FormElement) {
                    await input.updateComplete;
                    input.setAriaLabel(label);
                }
            }
        })
    ], FormfieldBase.prototype, "label", void 0);
    __decorate([
        query('.mdc-form-field')
    ], FormfieldBase.prototype, "mdcRoot", void 0);
    __decorate([
        query('slot')
    ], FormfieldBase.prototype, "slotEl", void 0);
    __decorate([
        query('label')
    ], FormfieldBase.prototype, "labelEl", void 0);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$5 = css `.mdc-form-field{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-body2-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.875rem;font-size:var(--mdc-typography-body2-font-size, 0.875rem);line-height:1.25rem;line-height:var(--mdc-typography-body2-line-height, 1.25rem);font-weight:400;font-weight:var(--mdc-typography-body2-font-weight, 400);letter-spacing:0.0178571429em;letter-spacing:var(--mdc-typography-body2-letter-spacing, 0.0178571429em);text-decoration:inherit;text-decoration:var(--mdc-typography-body2-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-body2-text-transform, inherit);color:rgba(0, 0, 0, 0.87);color:var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87));display:inline-flex;align-items:center;vertical-align:middle}.mdc-form-field>label{margin-left:0;margin-right:auto;padding-left:4px;padding-right:0;order:0}[dir=rtl] .mdc-form-field>label,.mdc-form-field>label[dir=rtl]{margin-left:auto;margin-right:0}[dir=rtl] .mdc-form-field>label,.mdc-form-field>label[dir=rtl]{padding-left:0;padding-right:4px}.mdc-form-field--nowrap>label{text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.mdc-form-field--align-end>label{margin-left:auto;margin-right:0;padding-left:0;padding-right:4px;order:-1}[dir=rtl] .mdc-form-field--align-end>label,.mdc-form-field--align-end>label[dir=rtl]{margin-left:0;margin-right:auto}[dir=rtl] .mdc-form-field--align-end>label,.mdc-form-field--align-end>label[dir=rtl]{padding-left:4px;padding-right:0}.mdc-form-field--space-between{justify-content:space-between}.mdc-form-field--space-between>label{margin:0}[dir=rtl] .mdc-form-field--space-between>label,.mdc-form-field--space-between>label[dir=rtl]{margin:0}:host{display:inline-flex}.mdc-form-field{width:100%}::slotted(*){-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-body2-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.875rem;font-size:var(--mdc-typography-body2-font-size, 0.875rem);line-height:1.25rem;line-height:var(--mdc-typography-body2-line-height, 1.25rem);font-weight:400;font-weight:var(--mdc-typography-body2-font-weight, 400);letter-spacing:0.0178571429em;letter-spacing:var(--mdc-typography-body2-letter-spacing, 0.0178571429em);text-decoration:inherit;text-decoration:var(--mdc-typography-body2-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-body2-text-transform, inherit);color:rgba(0, 0, 0, 0.87);color:var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87))}::slotted(mwc-switch){margin-right:10px}[dir=rtl] ::slotted(mwc-switch),::slotted(mwc-switch)[dir=rtl]{margin-left:10px}`;

    let Formfield = class Formfield extends FormfieldBase {
    };
    Formfield.styles = style$5;
    Formfield = __decorate([
        customElement('mwc-formfield')
    ], Formfield);

    /**
     * @license
     * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    const previousValues = new WeakMap();
    /**
     * For AttributeParts, sets the attribute if the value is defined and removes
     * the attribute if the value is undefined.
     *
     * For other part types, this directive is a no-op.
     */
    const ifDefined = directive((value) => (part) => {
        const previousValue = previousValues.get(part);
        if (value === undefined && part instanceof AttributePart) {
            // If the value is undefined, remove the attribute, but only if the value
            // was previously defined.
            if (previousValue !== undefined || !previousValues.has(part)) {
                const name = part.committer.name;
                part.committer.element.removeAttribute(name);
            }
        }
        else if (value !== previousValue) {
            part.setValue(value);
        }
        previousValues.set(part, value);
    });

    /** @soyCompatible */
    class CheckboxBase extends FormElement {
        constructor() {
            super(...arguments);
            this.checked = false;
            this.indeterminate = false;
            this.disabled = false;
            this.value = '';
            /**
             * Touch target extends beyond visual boundary of a component by default.
             * Set to `true` to remove touch target added to the component.
             * @see https://material.io/design/usability/accessibility.html
             */
            this.reducedTouchTarget = false;
            this.animationClass = '';
            this.shouldRenderRipple = false;
            this.focused = false;
            // MDC Foundation is unused
            this.mdcFoundationClass = undefined;
            this.mdcFoundation = undefined;
            this.rippleElement = null;
            this.rippleHandlers = new RippleHandlers(() => {
                this.shouldRenderRipple = true;
                this.ripple.then((v) => this.rippleElement = v);
                return this.ripple;
            });
        }
        createAdapter() {
            return {};
        }
        update(changedProperties) {
            const oldIndeterminate = changedProperties.get('indeterminate');
            const oldChecked = changedProperties.get('checked');
            const oldDisabled = changedProperties.get('disabled');
            if (oldIndeterminate !== undefined || oldChecked !== undefined ||
                oldDisabled !== undefined) {
                const oldState = this.calculateAnimationStateName(!!oldChecked, !!oldIndeterminate, !!oldDisabled);
                const newState = this.calculateAnimationStateName(this.checked, this.indeterminate, this.disabled);
                this.animationClass = `${oldState}-${newState}`;
            }
            super.update(changedProperties);
        }
        calculateAnimationStateName(checked, indeterminate, disabled) {
            if (disabled) {
                return 'disabled';
            }
            else if (indeterminate) {
                return 'indeterminate';
            }
            else if (checked) {
                return 'checked';
            }
            else {
                return 'unchecked';
            }
        }
        // TODO(dfreedm): Make this use selected as a param after Polymer/internal#739
        /** @soyTemplate */
        renderRipple() {
            const selected = this.indeterminate || this.checked;
            return this.shouldRenderRipple ? html `
        <mwc-ripple
          .accent="${selected}"
          .disabled="${this.disabled}"
          unbounded>
        </mwc-ripple>` :
                '';
        }
        /**
         * @soyTemplate
         * @soyAttributes checkboxAttributes: input
         * @soyClasses checkboxClasses: .mdc-checkbox
         */
        render() {
            const selected = this.indeterminate || this.checked;
            /* eslint-disable eqeqeq */
            // tslint:disable:triple-equals
            /** @classMap */
            const classes = {
                'mdc-checkbox--disabled': this.disabled,
                'mdc-checkbox--selected': selected,
                'mdc-checkbox--touch': !this.reducedTouchTarget,
                'mdc-ripple-upgraded--background-focused': this.focused,
                // transition animiation classes
                'mdc-checkbox--anim-checked-indeterminate': this.animationClass == 'checked-indeterminate',
                'mdc-checkbox--anim-checked-unchecked': this.animationClass == 'checked-unchecked',
                'mdc-checkbox--anim-indeterminate-checked': this.animationClass == 'indeterminate-checked',
                'mdc-checkbox--anim-indeterminate-unchecked': this.animationClass == 'indeterminate-unchecked',
                'mdc-checkbox--anim-unchecked-checked': this.animationClass == 'unchecked-checked',
                'mdc-checkbox--anim-unchecked-indeterminate': this.animationClass == 'unchecked-indeterminate',
            };
            // tslint:enable:triple-equals
            /* eslint-enable eqeqeq */
            const ariaChecked = this.indeterminate ? 'mixed' : undefined;
            return html `
      <div class="mdc-checkbox mdc-checkbox--upgraded ${classMap(classes)}">
        <input type="checkbox"
              class="mdc-checkbox__native-control"
              aria-checked="${ifDefined(ariaChecked)}"
              data-indeterminate="${this.indeterminate ? 'true' : 'false'}"
              ?disabled="${this.disabled}"
              .indeterminate="${this.indeterminate}"
              .checked="${this.checked}"
              .value="${this.value}"
              @change="${this._changeHandler}"
              @focus="${this._handleFocus}"
              @blur="${this._handleBlur}"
              @mousedown="${this.handleRippleMouseDown}"
              @mouseenter="${this.handleRippleMouseEnter}"
              @mouseleave="${this.handleRippleMouseLeave}"
              @touchstart="${this.handleRippleTouchStart}"
              @touchend="${this.handleRippleDeactivate}"
              @touchcancel="${this.handleRippleDeactivate}">
        <div class="mdc-checkbox__background"
          @animationend="${this.resetAnimationClass}">
          <svg class="mdc-checkbox__checkmark"
              viewBox="0 0 24 24">
            <path class="mdc-checkbox__checkmark-path"
                  fill="none"
                  d="M1.73,12.91 8.1,19.28 22.79,4.59"></path>
          </svg>
          <div class="mdc-checkbox__mixedmark"></div>
        </div>
        ${this.renderRipple()}
      </div>`;
        }
        _handleFocus() {
            this.focused = true;
            this.handleRippleFocus();
        }
        _handleBlur() {
            this.focused = false;
            this.handleRippleBlur();
        }
        handleRippleMouseDown(event) {
            const onUp = () => {
                window.removeEventListener('mouseup', onUp);
                this.handleRippleDeactivate();
            };
            window.addEventListener('mouseup', onUp);
            this.rippleHandlers.startPress(event);
        }
        handleRippleTouchStart(event) {
            this.rippleHandlers.startPress(event);
        }
        handleRippleDeactivate() {
            this.rippleHandlers.endPress();
        }
        handleRippleMouseEnter() {
            this.rippleHandlers.startHover();
        }
        handleRippleMouseLeave() {
            this.rippleHandlers.endHover();
        }
        handleRippleFocus() {
            this.rippleHandlers.startFocus();
        }
        handleRippleBlur() {
            this.rippleHandlers.endFocus();
        }
        _changeHandler() {
            this.checked = this.formElement.checked;
            this.indeterminate = this.formElement.indeterminate;
        }
        resetAnimationClass() {
            this.animationClass = '';
        }
        get isRippleActive() {
            var _a;
            return ((_a = this.rippleElement) === null || _a === void 0 ? void 0 : _a.isActive) || false;
        }
    }
    __decorate([
        query('.mdc-checkbox')
    ], CheckboxBase.prototype, "mdcRoot", void 0);
    __decorate([
        query('input')
    ], CheckboxBase.prototype, "formElement", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], CheckboxBase.prototype, "checked", void 0);
    __decorate([
        property({ type: Boolean })
    ], CheckboxBase.prototype, "indeterminate", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], CheckboxBase.prototype, "disabled", void 0);
    __decorate([
        property({ type: String })
    ], CheckboxBase.prototype, "value", void 0);
    __decorate([
        property({ type: Boolean })
    ], CheckboxBase.prototype, "reducedTouchTarget", void 0);
    __decorate([
        internalProperty()
    ], CheckboxBase.prototype, "animationClass", void 0);
    __decorate([
        internalProperty()
    ], CheckboxBase.prototype, "shouldRenderRipple", void 0);
    __decorate([
        internalProperty()
    ], CheckboxBase.prototype, "focused", void 0);
    __decorate([
        queryAsync('mwc-ripple')
    ], CheckboxBase.prototype, "ripple", void 0);
    __decorate([
        eventOptions({ passive: true })
    ], CheckboxBase.prototype, "handleRippleTouchStart", null);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$6 = css `.mdc-checkbox{padding:11px;margin-top:0px;margin-bottom:0px;margin-right:0px;margin-left:0px}.mdc-checkbox .mdc-checkbox__ripple::before,.mdc-checkbox .mdc-checkbox__ripple::after{background-color:#000;background-color:var(--mdc-ripple-color, #000)}.mdc-checkbox:hover .mdc-checkbox__ripple::before,.mdc-checkbox.mdc-ripple-surface--hover .mdc-checkbox__ripple::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-checkbox.mdc-ripple-upgraded--background-focused .mdc-checkbox__ripple::before,.mdc-checkbox:not(.mdc-ripple-upgraded):focus .mdc-checkbox__ripple::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-checkbox:not(.mdc-ripple-upgraded) .mdc-checkbox__ripple::after{transition:opacity 150ms linear}.mdc-checkbox:not(.mdc-ripple-upgraded):active .mdc-checkbox__ripple::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-checkbox.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.12)}.mdc-checkbox .mdc-checkbox__native-control:checked~.mdc-checkbox__background::before,.mdc-checkbox .mdc-checkbox__native-control:indeterminate~.mdc-checkbox__background::before,.mdc-checkbox .mdc-checkbox__native-control[data-indeterminate=true]~.mdc-checkbox__background::before{background-color:#018786;background-color:var(--mdc-theme-secondary, #018786)}.mdc-checkbox.mdc-checkbox--selected .mdc-checkbox__ripple::before,.mdc-checkbox.mdc-checkbox--selected .mdc-checkbox__ripple::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-checkbox.mdc-checkbox--selected:hover .mdc-checkbox__ripple::before,.mdc-checkbox.mdc-checkbox--selected.mdc-ripple-surface--hover .mdc-checkbox__ripple::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-checkbox.mdc-checkbox--selected.mdc-ripple-upgraded--background-focused .mdc-checkbox__ripple::before,.mdc-checkbox.mdc-checkbox--selected:not(.mdc-ripple-upgraded):focus .mdc-checkbox__ripple::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-checkbox.mdc-checkbox--selected:not(.mdc-ripple-upgraded) .mdc-checkbox__ripple::after{transition:opacity 150ms linear}.mdc-checkbox.mdc-checkbox--selected:not(.mdc-ripple-upgraded):active .mdc-checkbox__ripple::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-checkbox.mdc-checkbox--selected.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.12)}.mdc-checkbox.mdc-ripple-upgraded--background-focused.mdc-checkbox--selected .mdc-checkbox__ripple::before,.mdc-checkbox.mdc-ripple-upgraded--background-focused.mdc-checkbox--selected .mdc-checkbox__ripple::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-checkbox .mdc-checkbox__background{top:11px;left:11px}.mdc-checkbox .mdc-checkbox__background::before{top:-13px;left:-13px;width:40px;height:40px}.mdc-checkbox .mdc-checkbox__native-control{top:0px;right:0px;left:0px;width:40px;height:40px}.mdc-checkbox .mdc-checkbox__native-control:enabled:not(:checked):not(:indeterminate):not([data-indeterminate=true])~.mdc-checkbox__background{border-color:rgba(0, 0, 0, 0.54);border-color:var(--mdc-checkbox-unchecked-color, rgba(0, 0, 0, 0.54));background-color:transparent}.mdc-checkbox .mdc-checkbox__native-control:enabled:checked~.mdc-checkbox__background,.mdc-checkbox .mdc-checkbox__native-control:enabled:indeterminate~.mdc-checkbox__background,.mdc-checkbox .mdc-checkbox__native-control[data-indeterminate=true]:enabled~.mdc-checkbox__background{border-color:#018786;border-color:var(--mdc-checkbox-checked-color, var(--mdc-theme-secondary, #018786));background-color:#018786;background-color:var(--mdc-checkbox-checked-color, var(--mdc-theme-secondary, #018786))}@keyframes mdc-checkbox-fade-in-background-8A000000FF01878600000000FF018786{0%{border-color:rgba(0, 0, 0, 0.54);border-color:var(--mdc-checkbox-unchecked-color, rgba(0, 0, 0, 0.54));background-color:transparent}50%{border-color:#018786;border-color:var(--mdc-checkbox-checked-color, var(--mdc-theme-secondary, #018786));background-color:#018786;background-color:var(--mdc-checkbox-checked-color, var(--mdc-theme-secondary, #018786))}}@keyframes mdc-checkbox-fade-out-background-8A000000FF01878600000000FF018786{0%,80%{border-color:#018786;border-color:var(--mdc-checkbox-checked-color, var(--mdc-theme-secondary, #018786));background-color:#018786;background-color:var(--mdc-checkbox-checked-color, var(--mdc-theme-secondary, #018786))}100%{border-color:rgba(0, 0, 0, 0.54);border-color:var(--mdc-checkbox-unchecked-color, rgba(0, 0, 0, 0.54));background-color:transparent}}.mdc-checkbox.mdc-checkbox--anim-unchecked-checked .mdc-checkbox__native-control:enabled~.mdc-checkbox__background,.mdc-checkbox.mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__native-control:enabled~.mdc-checkbox__background{animation-name:mdc-checkbox-fade-in-background-8A000000FF01878600000000FF018786}.mdc-checkbox.mdc-checkbox--anim-checked-unchecked .mdc-checkbox__native-control:enabled~.mdc-checkbox__background,.mdc-checkbox.mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__native-control:enabled~.mdc-checkbox__background{animation-name:mdc-checkbox-fade-out-background-8A000000FF01878600000000FF018786}.mdc-checkbox .mdc-checkbox__native-control[disabled]:not(:checked):not(:indeterminate):not([data-indeterminate=true])~.mdc-checkbox__background{border-color:rgba(0, 0, 0, 0.38);border-color:var(--mdc-checkbox-disabled-color, rgba(0, 0, 0, 0.38));background-color:transparent}.mdc-checkbox .mdc-checkbox__native-control[disabled]:checked~.mdc-checkbox__background,.mdc-checkbox .mdc-checkbox__native-control[disabled]:indeterminate~.mdc-checkbox__background,.mdc-checkbox .mdc-checkbox__native-control[data-indeterminate=true][disabled]~.mdc-checkbox__background{border-color:transparent;background-color:rgba(0, 0, 0, 0.38);background-color:var(--mdc-checkbox-disabled-color, rgba(0, 0, 0, 0.38))}.mdc-checkbox .mdc-checkbox__native-control:enabled~.mdc-checkbox__background .mdc-checkbox__checkmark{color:#fff;color:var(--mdc-checkbox-ink-color, #fff)}.mdc-checkbox .mdc-checkbox__native-control:enabled~.mdc-checkbox__background .mdc-checkbox__mixedmark{border-color:#fff;border-color:var(--mdc-checkbox-ink-color, #fff)}.mdc-checkbox .mdc-checkbox__native-control:disabled~.mdc-checkbox__background .mdc-checkbox__checkmark{color:#fff;color:var(--mdc-checkbox-ink-color, #fff)}.mdc-checkbox .mdc-checkbox__native-control:disabled~.mdc-checkbox__background .mdc-checkbox__mixedmark{border-color:#fff;border-color:var(--mdc-checkbox-ink-color, #fff)}.mdc-touch-target-wrapper{display:inline}@keyframes mdc-checkbox-unchecked-checked-checkmark-path{0%,50%{stroke-dashoffset:29.7833385}50%{animation-timing-function:cubic-bezier(0, 0, 0.2, 1)}100%{stroke-dashoffset:0}}@keyframes mdc-checkbox-unchecked-indeterminate-mixedmark{0%,68.2%{transform:scaleX(0)}68.2%{animation-timing-function:cubic-bezier(0, 0, 0, 1)}100%{transform:scaleX(1)}}@keyframes mdc-checkbox-checked-unchecked-checkmark-path{from{animation-timing-function:cubic-bezier(0.4, 0, 1, 1);opacity:1;stroke-dashoffset:0}to{opacity:0;stroke-dashoffset:-29.7833385}}@keyframes mdc-checkbox-checked-indeterminate-checkmark{from{animation-timing-function:cubic-bezier(0, 0, 0.2, 1);transform:rotate(0deg);opacity:1}to{transform:rotate(45deg);opacity:0}}@keyframes mdc-checkbox-indeterminate-checked-checkmark{from{animation-timing-function:cubic-bezier(0.14, 0, 0, 1);transform:rotate(45deg);opacity:0}to{transform:rotate(360deg);opacity:1}}@keyframes mdc-checkbox-checked-indeterminate-mixedmark{from{animation-timing-function:mdc-animation-deceleration-curve-timing-function;transform:rotate(-45deg);opacity:0}to{transform:rotate(0deg);opacity:1}}@keyframes mdc-checkbox-indeterminate-checked-mixedmark{from{animation-timing-function:cubic-bezier(0.14, 0, 0, 1);transform:rotate(0deg);opacity:1}to{transform:rotate(315deg);opacity:0}}@keyframes mdc-checkbox-indeterminate-unchecked-mixedmark{0%{animation-timing-function:linear;transform:scaleX(1);opacity:1}32.8%,100%{transform:scaleX(0);opacity:0}}.mdc-checkbox{display:inline-block;position:relative;flex:0 0 18px;box-sizing:content-box;width:18px;height:18px;line-height:0;white-space:nowrap;cursor:pointer;vertical-align:bottom}@media screen and (-ms-high-contrast: active){.mdc-checkbox__native-control[disabled]:not(:checked):not(:indeterminate):not([data-indeterminate=true])~.mdc-checkbox__background{border-color:GrayText;border-color:var(--mdc-checkbox-disabled-color, GrayText);background-color:transparent}.mdc-checkbox__native-control[disabled]:checked~.mdc-checkbox__background,.mdc-checkbox__native-control[disabled]:indeterminate~.mdc-checkbox__background,.mdc-checkbox__native-control[data-indeterminate=true][disabled]~.mdc-checkbox__background{border-color:GrayText;background-color:transparent;background-color:var(--mdc-checkbox-disabled-color, transparent)}.mdc-checkbox__native-control:disabled~.mdc-checkbox__background .mdc-checkbox__checkmark{color:GrayText;color:var(--mdc-checkbox-ink-color, GrayText)}.mdc-checkbox__native-control:disabled~.mdc-checkbox__background .mdc-checkbox__mixedmark{border-color:GrayText;border-color:var(--mdc-checkbox-ink-color, GrayText)}.mdc-checkbox__mixedmark{margin:0 1px}}.mdc-checkbox--disabled{cursor:default;pointer-events:none}.mdc-checkbox__background{display:inline-flex;position:absolute;align-items:center;justify-content:center;box-sizing:border-box;width:18px;height:18px;border:2px solid currentColor;border-radius:2px;background-color:transparent;pointer-events:none;will-change:background-color,border-color;transition:background-color 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1),border-color 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1)}.mdc-checkbox__background .mdc-checkbox__background::before{background-color:#000;background-color:var(--mdc-theme-on-surface, #000)}.mdc-checkbox__checkmark{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;opacity:0;transition:opacity 180ms 0ms cubic-bezier(0.4, 0, 0.6, 1)}.mdc-checkbox--upgraded .mdc-checkbox__checkmark{opacity:1}.mdc-checkbox__checkmark-path{transition:stroke-dashoffset 180ms 0ms cubic-bezier(0.4, 0, 0.6, 1);stroke:currentColor;stroke-width:3.12px;stroke-dashoffset:29.7833385;stroke-dasharray:29.7833385}.mdc-checkbox__mixedmark{width:100%;height:0;transform:scaleX(0) rotate(0deg);border-width:1px;border-style:solid;opacity:0;transition:opacity 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1),transform 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1)}.mdc-checkbox--anim-unchecked-checked .mdc-checkbox__background,.mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__background,.mdc-checkbox--anim-checked-unchecked .mdc-checkbox__background,.mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__background{animation-duration:180ms;animation-timing-function:linear}.mdc-checkbox--anim-unchecked-checked .mdc-checkbox__checkmark-path{animation:mdc-checkbox-unchecked-checked-checkmark-path 180ms linear 0s;transition:none}.mdc-checkbox--anim-unchecked-indeterminate .mdc-checkbox__mixedmark{animation:mdc-checkbox-unchecked-indeterminate-mixedmark 90ms linear 0s;transition:none}.mdc-checkbox--anim-checked-unchecked .mdc-checkbox__checkmark-path{animation:mdc-checkbox-checked-unchecked-checkmark-path 90ms linear 0s;transition:none}.mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__checkmark{animation:mdc-checkbox-checked-indeterminate-checkmark 90ms linear 0s;transition:none}.mdc-checkbox--anim-checked-indeterminate .mdc-checkbox__mixedmark{animation:mdc-checkbox-checked-indeterminate-mixedmark 90ms linear 0s;transition:none}.mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__checkmark{animation:mdc-checkbox-indeterminate-checked-checkmark 500ms linear 0s;transition:none}.mdc-checkbox--anim-indeterminate-checked .mdc-checkbox__mixedmark{animation:mdc-checkbox-indeterminate-checked-mixedmark 500ms linear 0s;transition:none}.mdc-checkbox--anim-indeterminate-unchecked .mdc-checkbox__mixedmark{animation:mdc-checkbox-indeterminate-unchecked-mixedmark 300ms linear 0s;transition:none}.mdc-checkbox__native-control:checked~.mdc-checkbox__background,.mdc-checkbox__native-control:indeterminate~.mdc-checkbox__background,.mdc-checkbox__native-control[data-indeterminate=true]~.mdc-checkbox__background{transition:border-color 90ms 0ms cubic-bezier(0, 0, 0.2, 1),background-color 90ms 0ms cubic-bezier(0, 0, 0.2, 1)}.mdc-checkbox__native-control:checked~.mdc-checkbox__background .mdc-checkbox__checkmark-path,.mdc-checkbox__native-control:indeterminate~.mdc-checkbox__background .mdc-checkbox__checkmark-path,.mdc-checkbox__native-control[data-indeterminate=true]~.mdc-checkbox__background .mdc-checkbox__checkmark-path{stroke-dashoffset:0}.mdc-checkbox__background::before{position:absolute;transform:scale(0, 0);border-radius:50%;opacity:0;pointer-events:none;content:"";will-change:opacity,transform;transition:opacity 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1),transform 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1)}.mdc-checkbox__native-control:focus~.mdc-checkbox__background::before{transform:scale(1);opacity:.12;transition:opacity 80ms 0ms cubic-bezier(0, 0, 0.2, 1),transform 80ms 0ms cubic-bezier(0, 0, 0.2, 1)}.mdc-checkbox__native-control{position:absolute;margin:0;padding:0;opacity:0;cursor:inherit}.mdc-checkbox__native-control:disabled{cursor:default;pointer-events:none}.mdc-checkbox--touch{margin-top:4px;margin-bottom:4px;margin-right:4px;margin-left:4px}.mdc-checkbox--touch .mdc-checkbox__native-control{top:-4px;right:-4px;left:-4px;width:48px;height:48px}.mdc-checkbox__native-control:checked~.mdc-checkbox__background .mdc-checkbox__checkmark{transition:opacity 180ms 0ms cubic-bezier(0, 0, 0.2, 1),transform 180ms 0ms cubic-bezier(0, 0, 0.2, 1);opacity:1}.mdc-checkbox__native-control:checked~.mdc-checkbox__background .mdc-checkbox__mixedmark{transform:scaleX(1) rotate(-45deg)}.mdc-checkbox__native-control:indeterminate~.mdc-checkbox__background .mdc-checkbox__checkmark,.mdc-checkbox__native-control[data-indeterminate=true]~.mdc-checkbox__background .mdc-checkbox__checkmark{transform:rotate(45deg);opacity:0;transition:opacity 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1),transform 90ms 0ms cubic-bezier(0.4, 0, 0.6, 1)}.mdc-checkbox__native-control:indeterminate~.mdc-checkbox__background .mdc-checkbox__mixedmark,.mdc-checkbox__native-control[data-indeterminate=true]~.mdc-checkbox__background .mdc-checkbox__mixedmark{transform:scaleX(1) rotate(0deg);opacity:1}.mdc-checkbox.mdc-checkbox--upgraded .mdc-checkbox__background,.mdc-checkbox.mdc-checkbox--upgraded .mdc-checkbox__checkmark,.mdc-checkbox.mdc-checkbox--upgraded .mdc-checkbox__checkmark-path,.mdc-checkbox.mdc-checkbox--upgraded .mdc-checkbox__mixedmark{transition:none}:host{outline:none;display:inline-flex;-webkit-tap-highlight-color:transparent}.mdc-checkbox .mdc-checkbox__background::before{content:none}`;

    /** @soyCompatible */
    let Checkbox = class Checkbox extends CheckboxBase {
    };
    Checkbox.styles = style$6;
    Checkbox = __decorate([
        customElement('mwc-checkbox')
    ], Checkbox);

    var styles = css `
:host {
  display: flex;
  flex-direction: column;
  height: 100vh;
  --mdc-theme-primary: black;
}

[hide] {
  display: none !important;
}
[transparent] {
  opacity: 0 !important;
  transition: none !important;
}

#mainContainer {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

#answer {
  opacity: 1;
  transition: opacity 1s linear;
}

#meaning {
  font-size: 24px;
  margin: 24px 0;
  text-align: center;
  width: 100%;
  overflow: auto;
  white-space: nowrap;
  padding: 0 20px;
  box-sizing: border-box;
}


mwc-snackbar > snackbar-button {
  --mdc-theme-primary: #c7ac5a;
  margin-left: 5px;
}
`;

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$3 = function(d, b) {
        extendStatics$3 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$3(d, b);
    };

    function __extends$3(d, b) {
        extendStatics$3(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$3 = function() {
        __assign$3 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$3.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssPropertyNameMap = {
        animation: {
            prefixed: '-webkit-animation',
            standard: 'animation',
        },
        transform: {
            prefixed: '-webkit-transform',
            standard: 'transform',
        },
        transition: {
            prefixed: '-webkit-transition',
            standard: 'transition',
        },
    };
    var jsEventTypeMap = {
        animationend: {
            cssProperty: 'animation',
            prefixed: 'webkitAnimationEnd',
            standard: 'animationend',
        },
        animationiteration: {
            cssProperty: 'animation',
            prefixed: 'webkitAnimationIteration',
            standard: 'animationiteration',
        },
        animationstart: {
            cssProperty: 'animation',
            prefixed: 'webkitAnimationStart',
            standard: 'animationstart',
        },
        transitionend: {
            cssProperty: 'transition',
            prefixed: 'webkitTransitionEnd',
            standard: 'transitionend',
        },
    };
    function isWindow(windowObj) {
        return Boolean(windowObj.document) && typeof windowObj.document.createElement === 'function';
    }
    function getCorrectPropertyName(windowObj, cssProperty) {
        if (isWindow(windowObj) && cssProperty in cssPropertyNameMap) {
            var el = windowObj.document.createElement('div');
            var _a = cssPropertyNameMap[cssProperty], standard = _a.standard, prefixed = _a.prefixed;
            var isStandard = standard in el.style;
            return isStandard ? standard : prefixed;
        }
        return cssProperty;
    }
    function getCorrectEventName(windowObj, eventType) {
        if (isWindow(windowObj) && eventType in jsEventTypeMap) {
            var el = windowObj.document.createElement('div');
            var _a = jsEventTypeMap[eventType], standard = _a.standard, prefixed = _a.prefixed, cssProperty = _a.cssProperty;
            var isStandard = cssProperty in el.style;
            return isStandard ? standard : prefixed;
        }
        return eventType;
    }

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFoundation$1 = /** @class */ (function () {
        function MDCFoundation(adapter) {
            if (adapter === void 0) { adapter = {}; }
            this.adapter = adapter;
        }
        Object.defineProperty(MDCFoundation, "cssClasses", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports every
                // CSS class the foundation class needs as a property. e.g. {ACTIVE: 'mdc-component--active'}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "strings", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // semantic strings as constants. e.g. {ARIA_ROLE: 'tablist'}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "numbers", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // of its semantic numbers as constants. e.g. {ANIMATION_DELAY_MS: 350}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "defaultAdapter", {
            get: function () {
                // Classes extending MDCFoundation may choose to implement this getter in order to provide a convenient
                // way of viewing the necessary methods of an adapter. In the future, this could also be used for adapter
                // validation.
                return {};
            },
            enumerable: true,
            configurable: true
        });
        MDCFoundation.prototype.init = function () {
            // Subclasses should override this method to perform initialization routines (registering events, etc.)
        };
        MDCFoundation.prototype.destroy = function () {
            // Subclasses should override this method to perform de-initialization routines (de-registering events, etc.)
        };
        return MDCFoundation;
    }());

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$3 = {
        ACTIVE: 'mdc-slider--active',
        DISABLED: 'mdc-slider--disabled',
        DISCRETE: 'mdc-slider--discrete',
        FOCUS: 'mdc-slider--focus',
        HAS_TRACK_MARKER: 'mdc-slider--display-markers',
        IN_TRANSIT: 'mdc-slider--in-transit',
        IS_DISCRETE: 'mdc-slider--discrete',
        DISABLE_TOUCH_ACTION: 'mdc-slider--disable-touch-action',
    };
    var strings$3 = {
        ARIA_DISABLED: 'aria-disabled',
        ARIA_VALUEMAX: 'aria-valuemax',
        ARIA_VALUEMIN: 'aria-valuemin',
        ARIA_VALUENOW: 'aria-valuenow',
        CHANGE_EVENT: 'MDCSlider:change',
        INPUT_EVENT: 'MDCSlider:input',
        PIN_VALUE_MARKER_SELECTOR: '.mdc-slider__pin-value-marker',
        STEP_DATA_ATTR: 'data-step',
        THUMB_CONTAINER_SELECTOR: '.mdc-slider__thumb-container',
        TRACK_MARKER_CONTAINER_SELECTOR: '.mdc-slider__track-marker-container',
        TRACK_SELECTOR: '.mdc-slider__track',
    };
    var numbers$2 = {
        PAGE_FACTOR: 4,
    };

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    // Accessing `window` without a `typeof` check will throw on Node environments.
    var hasWindow = typeof window !== 'undefined';
    var hasPointerEventSupport = hasWindow && !!window.PointerEvent;
    var DOWN_EVENTS = hasPointerEventSupport ? ['pointerdown'] : ['mousedown', 'touchstart'];
    var UP_EVENTS = hasPointerEventSupport ? ['pointerup'] : ['mouseup', 'touchend'];
    var MOVE_EVENT_MAP = {
        mousedown: 'mousemove',
        pointerdown: 'pointermove',
        touchstart: 'touchmove',
    };
    var KEY_IDS = {
        ARROW_DOWN: 'ArrowDown',
        ARROW_LEFT: 'ArrowLeft',
        ARROW_RIGHT: 'ArrowRight',
        ARROW_UP: 'ArrowUp',
        END: 'End',
        HOME: 'Home',
        PAGE_DOWN: 'PageDown',
        PAGE_UP: 'PageUp',
    };
    var MDCSliderFoundation = /** @class */ (function (_super) {
        __extends$3(MDCSliderFoundation, _super);
        function MDCSliderFoundation(adapter) {
            var _this = _super.call(this, __assign$3(__assign$3({}, MDCSliderFoundation.defaultAdapter), adapter)) || this;
            /**
             * We set this to NaN since we want it to be a number, but we can't use '0' or
             * '-1' because those could be valid tabindices set by the client code.
             */
            _this.savedTabIndex_ = NaN;
            _this.active_ = false;
            _this.inTransit_ = false;
            _this.isDiscrete_ = false;
            _this.hasTrackMarker_ = false;
            _this.handlingThumbTargetEvt_ = false;
            _this.min_ = 0;
            _this.max_ = 100;
            _this.step_ = 0;
            _this.value_ = 0;
            _this.disabled_ = false;
            _this.preventFocusState_ = false;
            _this.thumbContainerPointerHandler_ = function () { return _this.handlingThumbTargetEvt_ =
                true; };
            _this.interactionStartHandler_ = function (evt) {
                return _this.handleDown_(evt);
            };
            _this.keydownHandler_ = function (evt) { return _this.handleKeydown_(evt); };
            _this.focusHandler_ = function () { return _this.handleFocus_(); };
            _this.blurHandler_ = function () { return _this.handleBlur_(); };
            _this.resizeHandler_ = function () { return _this.layout(); };
            return _this;
        }
        Object.defineProperty(MDCSliderFoundation, "cssClasses", {
            get: function () {
                return cssClasses$3;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSliderFoundation, "strings", {
            get: function () {
                return strings$3;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSliderFoundation, "numbers", {
            get: function () {
                return numbers$2;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSliderFoundation, "defaultAdapter", {
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same
                // order as the adapter interface.
                return {
                    hasClass: function () { return false; },
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    getAttribute: function () { return null; },
                    setAttribute: function () { return undefined; },
                    removeAttribute: function () { return undefined; },
                    computeBoundingRect: function () {
                        return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
                    },
                    getTabIndex: function () { return 0; },
                    registerInteractionHandler: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                    registerThumbContainerInteractionHandler: function () { return undefined; },
                    deregisterThumbContainerInteractionHandler: function () { return undefined; },
                    registerBodyInteractionHandler: function () { return undefined; },
                    deregisterBodyInteractionHandler: function () { return undefined; },
                    registerResizeHandler: function () { return undefined; },
                    deregisterResizeHandler: function () { return undefined; },
                    notifyInput: function () { return undefined; },
                    notifyChange: function () { return undefined; },
                    setThumbContainerStyleProperty: function () { return undefined; },
                    setTrackStyleProperty: function () { return undefined; },
                    setMarkerValue: function () { return undefined; },
                    setTrackMarkers: function () { return undefined; },
                    isRTL: function () { return false; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        MDCSliderFoundation.prototype.init = function () {
            var _this = this;
            this.isDiscrete_ = this.adapter.hasClass(cssClasses$3.IS_DISCRETE);
            this.hasTrackMarker_ = this.adapter.hasClass(cssClasses$3.HAS_TRACK_MARKER);
            DOWN_EVENTS.forEach(function (evtName) {
                _this.adapter.registerInteractionHandler(evtName, _this.interactionStartHandler_);
                _this.adapter.registerThumbContainerInteractionHandler(evtName, _this.thumbContainerPointerHandler_);
            });
            if (hasPointerEventSupport) {
                /*
                 * When pointermove happens, if too much sliding happens, the browser
                 * believes you are panning in the x direction and stops firing
                 * pointermove events and supplies its own gestures. (similar to
                 * preventing default on touchmove)
                 */
                this.adapter.addClass(cssClasses$3.DISABLE_TOUCH_ACTION);
            }
            this.adapter.registerInteractionHandler('keydown', this.keydownHandler_);
            this.adapter.registerInteractionHandler('focus', this.focusHandler_);
            this.adapter.registerInteractionHandler('blur', this.blurHandler_);
            this.adapter.registerResizeHandler(this.resizeHandler_);
            this.layout();
            // At last step, provide a reasonable default value to discrete slider
            if (this.isDiscrete_ && this.getStep() === 0) {
                this.step_ = 1;
            }
        };
        MDCSliderFoundation.prototype.destroy = function () {
            var _this = this;
            DOWN_EVENTS.forEach(function (evtName) {
                _this.adapter.deregisterInteractionHandler(evtName, _this.interactionStartHandler_);
                _this.adapter.deregisterThumbContainerInteractionHandler(evtName, _this.thumbContainerPointerHandler_);
            });
            this.adapter.deregisterInteractionHandler('keydown', this.keydownHandler_);
            this.adapter.deregisterInteractionHandler('focus', this.focusHandler_);
            this.adapter.deregisterInteractionHandler('blur', this.blurHandler_);
            this.adapter.deregisterResizeHandler(this.resizeHandler_);
        };
        MDCSliderFoundation.prototype.setupTrackMarker = function () {
            if (this.isDiscrete_ && this.hasTrackMarker_ && this.getStep() !== 0) {
                this.adapter.setTrackMarkers(this.getStep(), this.getMax(), this.getMin());
            }
        };
        MDCSliderFoundation.prototype.layout = function () {
            this.rect_ = this.adapter.computeBoundingRect();
            this.updateUIForCurrentValue_();
        };
        MDCSliderFoundation.prototype.getValue = function () {
            return this.value_;
        };
        MDCSliderFoundation.prototype.setValue = function (value) {
            this.setValue_(value, false);
        };
        MDCSliderFoundation.prototype.getMax = function () {
            return this.max_;
        };
        MDCSliderFoundation.prototype.setMax = function (max) {
            if (max < this.min_) {
                throw new Error('Cannot set max to be less than the slider\'s minimum value');
            }
            this.max_ = max;
            this.setValue_(this.value_, false, true);
            this.adapter.setAttribute(strings$3.ARIA_VALUEMAX, String(this.max_));
            this.setupTrackMarker();
        };
        MDCSliderFoundation.prototype.getMin = function () {
            return this.min_;
        };
        MDCSliderFoundation.prototype.setMin = function (min) {
            if (min > this.max_) {
                throw new Error('Cannot set min to be greater than the slider\'s maximum value');
            }
            this.min_ = min;
            this.setValue_(this.value_, false, true);
            this.adapter.setAttribute(strings$3.ARIA_VALUEMIN, String(this.min_));
            this.setupTrackMarker();
        };
        MDCSliderFoundation.prototype.getStep = function () {
            return this.step_;
        };
        MDCSliderFoundation.prototype.setStep = function (step) {
            if (step < 0) {
                throw new Error('Step cannot be set to a negative number');
            }
            if (this.isDiscrete_ && (typeof (step) !== 'number' || step < 1)) {
                step = 1;
            }
            this.step_ = step;
            this.setValue_(this.value_, false, true);
            this.setupTrackMarker();
        };
        MDCSliderFoundation.prototype.isDisabled = function () {
            return this.disabled_;
        };
        MDCSliderFoundation.prototype.setDisabled = function (disabled) {
            this.disabled_ = disabled;
            this.toggleClass_(cssClasses$3.DISABLED, this.disabled_);
            if (this.disabled_) {
                this.savedTabIndex_ = this.adapter.getTabIndex();
                this.adapter.setAttribute(strings$3.ARIA_DISABLED, 'true');
                this.adapter.removeAttribute('tabindex');
            }
            else {
                this.adapter.removeAttribute(strings$3.ARIA_DISABLED);
                if (!isNaN(this.savedTabIndex_)) {
                    this.adapter.setAttribute('tabindex', String(this.savedTabIndex_));
                }
            }
        };
        /**
         * Called when the user starts interacting with the slider
         */
        MDCSliderFoundation.prototype.handleDown_ = function (downEvent) {
            var _this = this;
            if (this.disabled_) {
                return;
            }
            this.preventFocusState_ = true;
            this.setInTransit_(!this.handlingThumbTargetEvt_);
            this.handlingThumbTargetEvt_ = false;
            this.setActive_(true);
            var moveHandler = function (moveEvent) {
                _this.handleMove_(moveEvent);
            };
            var moveEventType = MOVE_EVENT_MAP[downEvent.type];
            // Note: upHandler is [de]registered on ALL potential pointer-related
            // release event types, since some browsers do not always fire these
            // consistently in pairs. (See
            // https://github.com/material-components/material-components-web/issues/1192)
            var upHandler = function () {
                _this.handleUp_();
                _this.adapter.deregisterBodyInteractionHandler(moveEventType, moveHandler);
                UP_EVENTS.forEach(function (evtName) { return _this.adapter.deregisterBodyInteractionHandler(evtName, upHandler); });
            };
            this.adapter.registerBodyInteractionHandler(moveEventType, moveHandler);
            UP_EVENTS.forEach(function (evtName) {
                return _this.adapter.registerBodyInteractionHandler(evtName, upHandler);
            });
            this.setValueFromEvt_(downEvent);
        };
        /**
         * Called when the user moves the slider
         */
        MDCSliderFoundation.prototype.handleMove_ = function (evt) {
            evt.preventDefault();
            this.setValueFromEvt_(evt);
        };
        /**
         * Called when the user's interaction with the slider ends
         */
        MDCSliderFoundation.prototype.handleUp_ = function () {
            this.setActive_(false);
            this.adapter.notifyChange();
        };
        /**
         * Returns the clientX of the event
         */
        MDCSliderFoundation.prototype.getClientX_ = function (evt) {
            if (evt.targetTouches &&
                evt.targetTouches.length > 0) {
                return evt.targetTouches[0].clientX;
            }
            return evt.clientX;
        };
        /**
         * Sets the slider value from an event
         */
        MDCSliderFoundation.prototype.setValueFromEvt_ = function (evt) {
            var clientX = this.getClientX_(evt);
            var value = this.computeValueFromClientX_(clientX);
            this.setValue_(value, true);
        };
        /**
         * Computes the new value from the clientX position
         */
        MDCSliderFoundation.prototype.computeValueFromClientX_ = function (clientX) {
            var _a = this, max = _a.max_, min = _a.min_;
            var xPos = clientX - this.rect_.left;
            var pctComplete = xPos / this.rect_.width;
            if (this.adapter.isRTL()) {
                pctComplete = 1 - pctComplete;
            }
            // Fit the percentage complete between the range [min,max]
            // by remapping from [0, 1] to [min, min+(max-min)].
            return min + pctComplete * (max - min);
        };
        /**
         * Handles keydown events
         */
        MDCSliderFoundation.prototype.handleKeydown_ = function (evt) {
            var keyId = this.getKeyId_(evt);
            var value = this.getValueForKeyId_(keyId);
            if (isNaN(value)) {
                return;
            }
            // Prevent page from scrolling due to key presses that would normally scroll
            // the page
            evt.preventDefault();
            this.adapter.addClass(cssClasses$3.FOCUS);
            this.setValue_(value, true);
            this.adapter.notifyChange();
        };
        /**
         * Returns the computed name of the event
         */
        MDCSliderFoundation.prototype.getKeyId_ = function (kbdEvt) {
            if (kbdEvt.key === KEY_IDS.ARROW_LEFT || kbdEvt.keyCode === 37) {
                return KEY_IDS.ARROW_LEFT;
            }
            if (kbdEvt.key === KEY_IDS.ARROW_RIGHT || kbdEvt.keyCode === 39) {
                return KEY_IDS.ARROW_RIGHT;
            }
            if (kbdEvt.key === KEY_IDS.ARROW_UP || kbdEvt.keyCode === 38) {
                return KEY_IDS.ARROW_UP;
            }
            if (kbdEvt.key === KEY_IDS.ARROW_DOWN || kbdEvt.keyCode === 40) {
                return KEY_IDS.ARROW_DOWN;
            }
            if (kbdEvt.key === KEY_IDS.HOME || kbdEvt.keyCode === 36) {
                return KEY_IDS.HOME;
            }
            if (kbdEvt.key === KEY_IDS.END || kbdEvt.keyCode === 35) {
                return KEY_IDS.END;
            }
            if (kbdEvt.key === KEY_IDS.PAGE_UP || kbdEvt.keyCode === 33) {
                return KEY_IDS.PAGE_UP;
            }
            if (kbdEvt.key === KEY_IDS.PAGE_DOWN || kbdEvt.keyCode === 34) {
                return KEY_IDS.PAGE_DOWN;
            }
            return '';
        };
        /**
         * Computes the value given a keyboard key ID
         */
        MDCSliderFoundation.prototype.getValueForKeyId_ = function (keyId) {
            var _a = this, max = _a.max_, min = _a.min_, step = _a.step_;
            var delta = step || (max - min) / 100;
            var valueNeedsToBeFlipped = this.adapter.isRTL() &&
                (keyId === KEY_IDS.ARROW_LEFT || keyId === KEY_IDS.ARROW_RIGHT);
            if (valueNeedsToBeFlipped) {
                delta = -delta;
            }
            switch (keyId) {
                case KEY_IDS.ARROW_LEFT:
                case KEY_IDS.ARROW_DOWN:
                    return this.value_ - delta;
                case KEY_IDS.ARROW_RIGHT:
                case KEY_IDS.ARROW_UP:
                    return this.value_ + delta;
                case KEY_IDS.HOME:
                    return this.min_;
                case KEY_IDS.END:
                    return this.max_;
                case KEY_IDS.PAGE_UP:
                    return this.value_ + delta * numbers$2.PAGE_FACTOR;
                case KEY_IDS.PAGE_DOWN:
                    return this.value_ - delta * numbers$2.PAGE_FACTOR;
                default:
                    return NaN;
            }
        };
        MDCSliderFoundation.prototype.handleFocus_ = function () {
            if (this.preventFocusState_) {
                return;
            }
            this.adapter.addClass(cssClasses$3.FOCUS);
        };
        MDCSliderFoundation.prototype.handleBlur_ = function () {
            this.preventFocusState_ = false;
            this.adapter.removeClass(cssClasses$3.FOCUS);
        };
        /**
         * Sets the value of the slider
         */
        MDCSliderFoundation.prototype.setValue_ = function (value, shouldFireInput, force) {
            if (force === void 0) { force = false; }
            if (value === this.value_ && !force) {
                return;
            }
            var _a = this, min = _a.min_, max = _a.max_;
            var valueSetToBoundary = value === min || value === max;
            if (this.step_ && !valueSetToBoundary) {
                value = this.quantize_(value);
            }
            if (value < min) {
                value = min;
            }
            else if (value > max) {
                value = max;
            }
            value = value || 0; // coerce -0 to 0
            this.value_ = value;
            this.adapter.setAttribute(strings$3.ARIA_VALUENOW, String(this.value_));
            this.updateUIForCurrentValue_();
            if (shouldFireInput) {
                this.adapter.notifyInput();
                if (this.isDiscrete_) {
                    this.adapter.setMarkerValue(value);
                }
            }
        };
        /**
         * Calculates the quantized value
         */
        MDCSliderFoundation.prototype.quantize_ = function (value) {
            var numSteps = Math.round(value / this.step_);
            return numSteps * this.step_;
        };
        MDCSliderFoundation.prototype.updateUIForCurrentValue_ = function () {
            var _this = this;
            var _a = this, max = _a.max_, min = _a.min_, value = _a.value_;
            var pctComplete = (value - min) / (max - min);
            var translatePx = pctComplete * this.rect_.width;
            if (this.adapter.isRTL()) {
                translatePx = this.rect_.width - translatePx;
            }
            var transformProp = hasWindow ? getCorrectPropertyName(window, 'transform') : 'transform';
            var transitionendEvtName = hasWindow ? getCorrectEventName(window, 'transitionend') : 'transitionend';
            if (this.inTransit_) {
                var onTransitionEnd_1 = function () {
                    _this.setInTransit_(false);
                    _this.adapter.deregisterThumbContainerInteractionHandler(transitionendEvtName, onTransitionEnd_1);
                };
                this.adapter.registerThumbContainerInteractionHandler(transitionendEvtName, onTransitionEnd_1);
            }
            requestAnimationFrame(function () {
                // NOTE(traviskaufman): It would be nice to use calc() here,
                // but IE cannot handle calcs in transforms correctly.
                // See: https://goo.gl/NC2itk
                // Also note that the -50% offset is used to center the slider thumb.
                _this.adapter.setThumbContainerStyleProperty(transformProp, "translateX(" + translatePx + "px) translateX(-50%)");
                _this.adapter.setTrackStyleProperty(transformProp, "scaleX(" + pctComplete + ")");
            });
        };
        /**
         * Toggles the active state of the slider
         */
        MDCSliderFoundation.prototype.setActive_ = function (active) {
            this.active_ = active;
            this.toggleClass_(cssClasses$3.ACTIVE, this.active_);
        };
        /**
         * Toggles the inTransit state of the slider
         */
        MDCSliderFoundation.prototype.setInTransit_ = function (inTransit) {
            this.inTransit_ = inTransit;
            this.toggleClass_(cssClasses$3.IN_TRANSIT, this.inTransit_);
        };
        /**
         * Conditionally adds or removes a class based on shouldBePresent
         */
        MDCSliderFoundation.prototype.toggleClass_ = function (className, shouldBePresent) {
            if (shouldBePresent) {
                this.adapter.addClass(className);
            }
            else {
                this.adapter.removeClass(className);
            }
        };
        return MDCSliderFoundation;
    }(MDCFoundation$1));

    const INPUT_EVENT = 'input';
    const CHANGE_EVENT = 'change';
    class SliderBase extends FormElement {
        constructor() {
            super(...arguments);
            this.mdcFoundationClass = MDCSliderFoundation;
            this.min = 0;
            this.max = 100;
            this._value = 0;
            this.step = 0;
            this.disabled = false;
            this.pin = false;
            this.markers = false;
            this.pinMarkerText = '';
            this.trackMarkerContainerStyles = {};
            this.thumbContainerStyles = {};
            this.trackStyles = {};
            this.isFoundationDestroyed = false;
        }
        set value(value) {
            if (this.mdcFoundation) {
                this.mdcFoundation.setValue(value);
            }
            this._value = value;
            this.requestUpdate('value', value);
        }
        get value() {
            if (this.mdcFoundation) {
                return this.mdcFoundation.getValue();
            }
            else {
                return this._value;
            }
        }
        // TODO(sorvell) #css: needs a default width
        render() {
            const isDiscrete = this.step !== 0;
            const hostClassInfo = {
                'mdc-slider--discrete': isDiscrete,
                'mdc-slider--display-markers': this.markers && isDiscrete,
            };
            let markersTemplate = '';
            if (isDiscrete && this.markers) {
                markersTemplate = html `
        <div
            class="mdc-slider__track-marker-container"
            style="${styleMap(this.trackMarkerContainerStyles)}">
        </div>`;
            }
            let pin = '';
            if (this.pin) {
                pin = html `
      <div class="mdc-slider__pin">
        <span class="mdc-slider__pin-value-marker">${this.pinMarkerText}</span>
      </div>`;
            }
            return html `
      <div class="mdc-slider ${classMap(hostClassInfo)}"
           tabindex="0" role="slider"
           aria-valuemin="${this.min}" aria-valuemax="${this.max}"
           aria-valuenow="${this.value}"
           aria-disabled="${this.disabled.toString()}"
           data-step="${this.step}"
           @mousedown=${this.layout}
           @touchstart=${this.layout}>
        <div class="mdc-slider__track-container">
          <div
              class="mdc-slider__track"
              style="${styleMap(this.trackStyles)}">
          </div>
          ${markersTemplate}
        </div>
        <div
            class="mdc-slider__thumb-container"
            style="${styleMap(this.thumbContainerStyles)}">
          <!-- TODO: use cache() directive -->
          ${pin}
          <svg class="mdc-slider__thumb" width="21" height="21">
            <circle cx="10.5" cy="10.5" r="7.875"></circle>
          </svg>
        <div class="mdc-slider__focus-ring"></div>
      </div>
    </div>`;
        }
        connectedCallback() {
            super.connectedCallback();
            if (this.mdcRoot && this.isFoundationDestroyed) {
                this.isFoundationDestroyed = false;
                this.mdcFoundation.init();
            }
        }
        updated(changed) {
            const minChanged = changed.has('min');
            const maxChanged = changed.has('max');
            if (minChanged && maxChanged) {
                if (this.max < this.mdcFoundation.getMin()) {
                    // for when min is above previous max
                    this.mdcFoundation.setMin(this.min);
                    this.mdcFoundation.setMax(this.max);
                }
                else {
                    // for when max is below previous min
                    this.mdcFoundation.setMax(this.max);
                    this.mdcFoundation.setMin(this.min);
                }
            }
            else if (minChanged) {
                this.mdcFoundation.setMin(this.min);
            }
            else if (maxChanged) {
                this.mdcFoundation.setMax(this.max);
            }
            super.updated(changed);
        }
        disconnectedCallback() {
            super.disconnectedCallback();
            this.isFoundationDestroyed = true;
            this.mdcFoundation.destroy();
        }
        createAdapter() {
            return Object.assign(Object.assign({}, addHasRemoveClass(this.mdcRoot)), { getAttribute: (name) => this.mdcRoot.getAttribute(name), setAttribute: (name, value) => this.mdcRoot.setAttribute(name, value), removeAttribute: (name) => this.mdcRoot.removeAttribute(name), computeBoundingRect: () => {
                    const rect = this.mdcRoot.getBoundingClientRect();
                    const myRect = {
                        bottom: rect.bottom,
                        height: rect.height,
                        left: rect.left + window.pageXOffset,
                        right: rect.right,
                        top: rect.top,
                        width: rect.width,
                    };
                    return myRect;
                }, getTabIndex: () => this.mdcRoot.tabIndex, registerInteractionHandler: (type, handler) => {
                    const init = type === 'touchstart' ? applyPassive() : undefined;
                    this.mdcRoot.addEventListener(type, handler, init);
                }, deregisterInteractionHandler: (type, handler) => this.mdcRoot.removeEventListener(type, handler), registerThumbContainerInteractionHandler: (type, handler) => {
                    const init = type === 'touchstart' ? applyPassive() : undefined;
                    this.thumbContainer.addEventListener(type, handler, init);
                }, deregisterThumbContainerInteractionHandler: (type, handler) => this.thumbContainer.removeEventListener(type, handler), registerBodyInteractionHandler: (type, handler) => document.body.addEventListener(type, handler), deregisterBodyInteractionHandler: (type, handler) => document.body.removeEventListener(type, handler), registerResizeHandler: (handler) => window.addEventListener('resize', handler, applyPassive()), deregisterResizeHandler: (handler) => window.removeEventListener('resize', handler), notifyInput: () => {
                    const value = this.mdcFoundation.getValue();
                    if (value !== this._value) {
                        this.value = value;
                        this.dispatchEvent(new CustomEvent(INPUT_EVENT, { detail: this, composed: true, bubbles: true, cancelable: true }));
                    }
                }, notifyChange: () => {
                    this.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: this, composed: true, bubbles: true, cancelable: true }));
                }, setThumbContainerStyleProperty: (propertyName, value) => {
                    this.thumbContainerStyles[propertyName] = value;
                    this.requestUpdate();
                }, setTrackStyleProperty: (propertyName, value) => {
                    this.trackStyles[propertyName] = value;
                    this.requestUpdate();
                }, setMarkerValue: (value) => this.pinMarkerText =
                    value.toLocaleString(), setTrackMarkers: (step, max, min) => {
                    // calculates the CSS for the notches on the slider. Taken from
                    // https://github.com/material-components/material-components-web/blob/8f851d9ed2f75dc8b8956d15b3bb2619e59fa8a9/packages/mdc-slider/component.ts#L122
                    const stepStr = step.toLocaleString();
                    const maxStr = max.toLocaleString();
                    const minStr = min.toLocaleString();
                    // keep calculation in css for better rounding/subpixel behavior
                    const markerAmount = `((${maxStr} - ${minStr}) / ${stepStr})`;
                    const markerWidth = '2px';
                    const markerBkgdImage = `linear-gradient(to right, currentColor ${markerWidth}, transparent 0)`;
                    const markerBkgdLayout = `0 center / calc((100% - ${markerWidth}) / ${markerAmount}) 100% repeat-x`;
                    const markerBkgdShorthand = `${markerBkgdImage} ${markerBkgdLayout}`;
                    this.trackMarkerContainerStyles['background'] = markerBkgdShorthand;
                    this.requestUpdate();
                }, isRTL: () => getComputedStyle(this.mdcRoot).direction === 'rtl' });
        }
        resetFoundation() {
            if (this.mdcFoundation) {
                this.mdcFoundation.destroy();
                this.mdcFoundation.init();
            }
        }
        async firstUpdated() {
            await super.firstUpdated();
            this.mdcFoundation.setValue(this._value);
        }
        /**
         * Layout is called on mousedown / touchstart as the dragging animations of
         * slider are calculated based off of the bounding rect which can change
         * between interactions with this component, and this is the only location
         * in the foundation that udpates the rects. e.g. scrolling horizontally
         * causes adverse effects on the bounding rect vs mouse drag / touchmove
         * location.
         */
        layout() {
            this.mdcFoundation.layout();
        }
    }
    __decorate([
        query('.mdc-slider')
    ], SliderBase.prototype, "mdcRoot", void 0);
    __decorate([
        query('.mdc-slider')
    ], SliderBase.prototype, "formElement", void 0);
    __decorate([
        query('.mdc-slider__thumb-container')
    ], SliderBase.prototype, "thumbContainer", void 0);
    __decorate([
        query('.mdc-slider__pin-value-marker')
    ], SliderBase.prototype, "pinMarker", void 0);
    __decorate([
        property({ type: Number })
    ], SliderBase.prototype, "min", void 0);
    __decorate([
        property({ type: Number })
    ], SliderBase.prototype, "max", void 0);
    __decorate([
        property({ type: Number })
    ], SliderBase.prototype, "value", null);
    __decorate([
        property({ type: Number }),
        observer(function (value, old) {
            const oldWasDiscrete = old !== 0;
            const newIsDiscrete = value !== 0;
            if (oldWasDiscrete !== newIsDiscrete) {
                this.resetFoundation();
            }
            this.mdcFoundation.setStep(value);
        })
    ], SliderBase.prototype, "step", void 0);
    __decorate([
        property({ type: Boolean, reflect: true }),
        observer(function (value) {
            this.mdcFoundation.setDisabled(value);
        })
    ], SliderBase.prototype, "disabled", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], SliderBase.prototype, "pin", void 0);
    __decorate([
        property({ type: Boolean, reflect: true }),
        observer(function () {
            this.mdcFoundation.setupTrackMarker();
        })
    ], SliderBase.prototype, "markers", void 0);
    __decorate([
        property({ type: String })
    ], SliderBase.prototype, "pinMarkerText", void 0);
    __decorate([
        property({ type: Object })
    ], SliderBase.prototype, "trackMarkerContainerStyles", void 0);
    __decorate([
        property({ type: Object })
    ], SliderBase.prototype, "thumbContainerStyles", void 0);
    __decorate([
        property({ type: Object })
    ], SliderBase.prototype, "trackStyles", void 0);
    __decorate([
        eventOptions({ capture: true, passive: true })
    ], SliderBase.prototype, "layout", null);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$7 = css `@keyframes mdc-slider-emphasize{0%{animation-timing-function:ease-out}50%{animation-timing-function:ease-in;transform:scale(0.85)}100%{transform:scale(0.571)}}.mdc-slider{position:relative;width:100%;height:48px;cursor:pointer;touch-action:pan-x;-webkit-tap-highlight-color:rgba(0,0,0,0)}.mdc-slider:not(.mdc-slider--disabled) .mdc-slider__track{background-color:#018786;background-color:var(--mdc-theme-secondary, #018786)}.mdc-slider:not(.mdc-slider--disabled) .mdc-slider__track-container::after{background-color:#018786;background-color:var(--mdc-theme-secondary, #018786);opacity:.26}.mdc-slider:not(.mdc-slider--disabled) .mdc-slider__track-marker-container{background-color:#018786;background-color:var(--mdc-theme-secondary, #018786)}.mdc-slider:not(.mdc-slider--disabled) .mdc-slider__thumb{fill:#018786;fill:var(--mdc-theme-secondary, #018786);stroke:#018786;stroke:var(--mdc-theme-secondary, #018786)}.mdc-slider:not(.mdc-slider--disabled) .mdc-slider__focus-ring{background-color:#018786;background-color:var(--mdc-theme-secondary, #018786)}.mdc-slider:not(.mdc-slider--disabled) .mdc-slider__pin{background-color:#018786;background-color:var(--mdc-theme-secondary, #018786)}.mdc-slider:not(.mdc-slider--disabled) .mdc-slider__pin{color:#fff;color:var(--mdc-theme-text-primary-on-dark, white)}.mdc-slider--disable-touch-action{touch-action:none}.mdc-slider--disabled{cursor:auto}.mdc-slider--disabled .mdc-slider__track{background-color:#9a9a9a}.mdc-slider--disabled .mdc-slider__track-container::after{background-color:#9a9a9a;opacity:.26}.mdc-slider--disabled .mdc-slider__track-marker-container{background-color:#9a9a9a}.mdc-slider--disabled .mdc-slider__thumb{fill:#9a9a9a;stroke:#9a9a9a}.mdc-slider--disabled .mdc-slider__thumb{stroke:#fff;stroke:var(--mdc-slider-bg-color-behind-component, white)}.mdc-slider:focus{outline:none}.mdc-slider__track-container{position:absolute;top:50%;width:100%;height:2px;overflow:hidden}.mdc-slider__track-container::after{position:absolute;top:0;left:0;display:block;width:100%;height:100%;content:""}.mdc-slider__track{position:absolute;width:100%;height:100%;transform-origin:left top;will-change:transform}.mdc-slider[dir=rtl] .mdc-slider__track,[dir=rtl] .mdc-slider .mdc-slider__track{transform-origin:right top}.mdc-slider__track-marker-container{display:flex;margin-right:0;margin-left:-1px;visibility:hidden}.mdc-slider[dir=rtl] .mdc-slider__track-marker-container,[dir=rtl] .mdc-slider .mdc-slider__track-marker-container{margin-right:-1px;margin-left:0}.mdc-slider__track-marker-container::after{display:block;width:2px;height:2px;content:""}.mdc-slider__track-marker{flex:1}.mdc-slider__track-marker::after{display:block;width:2px;height:2px;content:""}.mdc-slider__track-marker:first-child::after{width:3px}.mdc-slider__thumb-container{position:absolute;top:15px;left:0;width:21px;height:100%;user-select:none;will-change:transform}.mdc-slider__thumb{position:absolute;top:0;left:0;transform:scale(0.571);stroke-width:3.5;transition:transform 100ms ease-out,fill 100ms ease-out,stroke 100ms ease-out}.mdc-slider__focus-ring{width:21px;height:21px;border-radius:50%;opacity:0;transition:transform 266.67ms ease-out,opacity 266.67ms ease-out,background-color 266.67ms ease-out}.mdc-slider__pin{display:flex;position:absolute;top:0;left:0;align-items:center;justify-content:center;width:26px;height:26px;margin-top:-2px;margin-left:-2px;transform:rotate(-45deg) scale(0) translate(0, 0);border-radius:50% 50% 50% 0%;z-index:1;transition:transform 100ms ease-out}.mdc-slider__pin-value-marker{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-body2-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.875rem;font-size:var(--mdc-typography-body2-font-size, 0.875rem);line-height:1.25rem;line-height:var(--mdc-typography-body2-line-height, 1.25rem);font-weight:400;font-weight:var(--mdc-typography-body2-font-weight, 400);letter-spacing:0.0178571429em;letter-spacing:var(--mdc-typography-body2-letter-spacing, 0.0178571429em);text-decoration:inherit;text-decoration:var(--mdc-typography-body2-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-body2-text-transform, inherit);transform:rotate(45deg)}.mdc-slider--active .mdc-slider__thumb{transform:scale3d(1, 1, 1)}.mdc-slider--focus .mdc-slider__thumb{animation:mdc-slider-emphasize 266.67ms linear}.mdc-slider--focus .mdc-slider__focus-ring{transform:scale3d(1.55, 1.55, 1.55);opacity:.25}.mdc-slider--in-transit .mdc-slider__thumb{transition-delay:140ms}.mdc-slider--in-transit .mdc-slider__thumb-container,.mdc-slider--in-transit .mdc-slider__track,.mdc-slider:focus:not(.mdc-slider--active) .mdc-slider__thumb-container,.mdc-slider:focus:not(.mdc-slider--active) .mdc-slider__track{transition:transform 80ms ease}.mdc-slider--discrete.mdc-slider--active .mdc-slider__thumb{transform:scale(calc(12 / 21))}.mdc-slider--discrete.mdc-slider--active .mdc-slider__pin{transform:rotate(-45deg) scale(1) translate(19px, -20px)}.mdc-slider--discrete.mdc-slider--focus .mdc-slider__thumb{animation:none}.mdc-slider--discrete.mdc-slider--display-markers .mdc-slider__track-marker-container{visibility:visible}:host{display:inline-block;min-width:120px;outline:none}`;

    let Slider = class Slider extends SliderBase {
    };
    Slider.styles = style$7;
    Slider = __decorate([
        customElement('mwc-slider')
    ], Slider);

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$4 = function(d, b) {
        extendStatics$4 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$4(d, b);
    };

    function __extends$4(d, b) {
        extendStatics$4(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$4 = function() {
        __assign$4 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$4.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$4 = {
        CLOSING: 'mdc-snackbar--closing',
        OPEN: 'mdc-snackbar--open',
        OPENING: 'mdc-snackbar--opening',
    };
    var strings$4 = {
        ACTION_SELECTOR: '.mdc-snackbar__action',
        ARIA_LIVE_LABEL_TEXT_ATTR: 'data-mdc-snackbar-label-text',
        CLOSED_EVENT: 'MDCSnackbar:closed',
        CLOSING_EVENT: 'MDCSnackbar:closing',
        DISMISS_SELECTOR: '.mdc-snackbar__dismiss',
        LABEL_SELECTOR: '.mdc-snackbar__label',
        OPENED_EVENT: 'MDCSnackbar:opened',
        OPENING_EVENT: 'MDCSnackbar:opening',
        REASON_ACTION: 'action',
        REASON_DISMISS: 'dismiss',
        SURFACE_SELECTOR: '.mdc-snackbar__surface',
    };
    var numbers$3 = {
        DEFAULT_AUTO_DISMISS_TIMEOUT_MS: 5000,
        INDETERMINATE: -1,
        MAX_AUTO_DISMISS_TIMEOUT_MS: 10000,
        MIN_AUTO_DISMISS_TIMEOUT_MS: 4000,
        // These variables need to be kept in sync with the values in _variables.scss.
        SNACKBAR_ANIMATION_CLOSE_TIME_MS: 75,
        SNACKBAR_ANIMATION_OPEN_TIME_MS: 150,
        /**
         * Number of milliseconds to wait between temporarily clearing the label text
         * in the DOM and subsequently restoring it. This is necessary to force IE 11
         * to pick up the `aria-live` content change and announce it to the user.
         */
        ARIA_LIVE_DELAY_MS: 1000,
    };

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var OPENING = cssClasses$4.OPENING, OPEN = cssClasses$4.OPEN, CLOSING = cssClasses$4.CLOSING;
    var REASON_ACTION = strings$4.REASON_ACTION, REASON_DISMISS = strings$4.REASON_DISMISS;
    var MDCSnackbarFoundation = /** @class */ (function (_super) {
        __extends$4(MDCSnackbarFoundation, _super);
        function MDCSnackbarFoundation(adapter) {
            var _this = _super.call(this, __assign$4(__assign$4({}, MDCSnackbarFoundation.defaultAdapter), adapter)) || this;
            _this.isOpen_ = false;
            _this.animationFrame_ = 0;
            _this.animationTimer_ = 0;
            _this.autoDismissTimer_ = 0;
            _this.autoDismissTimeoutMs_ = numbers$3.DEFAULT_AUTO_DISMISS_TIMEOUT_MS;
            _this.closeOnEscape_ = true;
            return _this;
        }
        Object.defineProperty(MDCSnackbarFoundation, "cssClasses", {
            get: function () {
                return cssClasses$4;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSnackbarFoundation, "strings", {
            get: function () {
                return strings$4;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSnackbarFoundation, "numbers", {
            get: function () {
                return numbers$3;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSnackbarFoundation, "defaultAdapter", {
            get: function () {
                return {
                    addClass: function () { return undefined; },
                    announce: function () { return undefined; },
                    notifyClosed: function () { return undefined; },
                    notifyClosing: function () { return undefined; },
                    notifyOpened: function () { return undefined; },
                    notifyOpening: function () { return undefined; },
                    removeClass: function () { return undefined; },
                };
            },
            enumerable: true,
            configurable: true
        });
        MDCSnackbarFoundation.prototype.destroy = function () {
            this.clearAutoDismissTimer_();
            cancelAnimationFrame(this.animationFrame_);
            this.animationFrame_ = 0;
            clearTimeout(this.animationTimer_);
            this.animationTimer_ = 0;
            this.adapter.removeClass(OPENING);
            this.adapter.removeClass(OPEN);
            this.adapter.removeClass(CLOSING);
        };
        MDCSnackbarFoundation.prototype.open = function () {
            var _this = this;
            this.clearAutoDismissTimer_();
            this.isOpen_ = true;
            this.adapter.notifyOpening();
            this.adapter.removeClass(CLOSING);
            this.adapter.addClass(OPENING);
            this.adapter.announce();
            // Wait a frame once display is no longer "none", to establish basis for animation
            this.runNextAnimationFrame_(function () {
                _this.adapter.addClass(OPEN);
                _this.animationTimer_ = setTimeout(function () {
                    var timeoutMs = _this.getTimeoutMs();
                    _this.handleAnimationTimerEnd_();
                    _this.adapter.notifyOpened();
                    if (timeoutMs !== numbers$3.INDETERMINATE) {
                        _this.autoDismissTimer_ = setTimeout(function () {
                            _this.close(REASON_DISMISS);
                        }, timeoutMs);
                    }
                }, numbers$3.SNACKBAR_ANIMATION_OPEN_TIME_MS);
            });
        };
        /**
         * @param reason Why the snackbar was closed. Value will be passed to CLOSING_EVENT and CLOSED_EVENT via the
         *     `event.detail.reason` property. Standard values are REASON_ACTION and REASON_DISMISS, but custom
         *     client-specific values may also be used if desired.
         */
        MDCSnackbarFoundation.prototype.close = function (reason) {
            var _this = this;
            if (reason === void 0) { reason = ''; }
            if (!this.isOpen_) {
                // Avoid redundant close calls (and events), e.g. repeated interactions as the snackbar is animating closed
                return;
            }
            cancelAnimationFrame(this.animationFrame_);
            this.animationFrame_ = 0;
            this.clearAutoDismissTimer_();
            this.isOpen_ = false;
            this.adapter.notifyClosing(reason);
            this.adapter.addClass(cssClasses$4.CLOSING);
            this.adapter.removeClass(cssClasses$4.OPEN);
            this.adapter.removeClass(cssClasses$4.OPENING);
            clearTimeout(this.animationTimer_);
            this.animationTimer_ = setTimeout(function () {
                _this.handleAnimationTimerEnd_();
                _this.adapter.notifyClosed(reason);
            }, numbers$3.SNACKBAR_ANIMATION_CLOSE_TIME_MS);
        };
        MDCSnackbarFoundation.prototype.isOpen = function () {
            return this.isOpen_;
        };
        MDCSnackbarFoundation.prototype.getTimeoutMs = function () {
            return this.autoDismissTimeoutMs_;
        };
        MDCSnackbarFoundation.prototype.setTimeoutMs = function (timeoutMs) {
            // Use shorter variable names to make the code more readable
            var minValue = numbers$3.MIN_AUTO_DISMISS_TIMEOUT_MS;
            var maxValue = numbers$3.MAX_AUTO_DISMISS_TIMEOUT_MS;
            var indeterminateValue = numbers$3.INDETERMINATE;
            if (timeoutMs === numbers$3.INDETERMINATE || (timeoutMs <= maxValue && timeoutMs >= minValue)) {
                this.autoDismissTimeoutMs_ = timeoutMs;
            }
            else {
                throw new Error("\n        timeoutMs must be an integer in the range " + minValue + "\u2013" + maxValue + "\n        (or " + indeterminateValue + " to disable), but got '" + timeoutMs + "'");
            }
        };
        MDCSnackbarFoundation.prototype.getCloseOnEscape = function () {
            return this.closeOnEscape_;
        };
        MDCSnackbarFoundation.prototype.setCloseOnEscape = function (closeOnEscape) {
            this.closeOnEscape_ = closeOnEscape;
        };
        MDCSnackbarFoundation.prototype.handleKeyDown = function (evt) {
            var isEscapeKey = evt.key === 'Escape' || evt.keyCode === 27;
            if (isEscapeKey && this.getCloseOnEscape()) {
                this.close(REASON_DISMISS);
            }
        };
        MDCSnackbarFoundation.prototype.handleActionButtonClick = function (_evt) {
            this.close(REASON_ACTION);
        };
        MDCSnackbarFoundation.prototype.handleActionIconClick = function (_evt) {
            this.close(REASON_DISMISS);
        };
        MDCSnackbarFoundation.prototype.clearAutoDismissTimer_ = function () {
            clearTimeout(this.autoDismissTimer_);
            this.autoDismissTimer_ = 0;
        };
        MDCSnackbarFoundation.prototype.handleAnimationTimerEnd_ = function () {
            this.animationTimer_ = 0;
            this.adapter.removeClass(cssClasses$4.OPENING);
            this.adapter.removeClass(cssClasses$4.CLOSING);
        };
        /**
         * Runs the given logic on the next animation frame, using setTimeout to factor in Firefox reflow behavior.
         */
        MDCSnackbarFoundation.prototype.runNextAnimationFrame_ = function (callback) {
            var _this = this;
            cancelAnimationFrame(this.animationFrame_);
            this.animationFrame_ = requestAnimationFrame(function () {
                _this.animationFrame_ = 0;
                clearTimeout(_this.animationTimer_);
                _this.animationTimer_ = setTimeout(callback, 0);
            });
        };
        return MDCSnackbarFoundation;
    }(MDCFoundation));

    /**
    @license
    Copyright 2019 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const { ARIA_LIVE_LABEL_TEXT_ATTR } = MDCSnackbarFoundation.strings;
    const { ARIA_LIVE_DELAY_MS } = MDCSnackbarFoundation.numbers;
    /**
     * Maps an accessibleLabel container part to its label element and the timeoutID
     * of the task that restores its text content from ::before back to textContent.
     */
    const stateMap = new WeakMap();
    /**
     * A lit directive implementation of @material/mdc-snackbar/util.ts#announce,
     * which does some tricks to ensure that snackbar labels will be handled
     * correctly by screen readers.
     *
     * The existing MDC announce util function is difficult to use directly here,
     * because Lit can crash when DOM that it is managing changes outside of its
     * purvue. In this case, we would render our labelText as the text content of
     * the label div, but the MDC announce function then clears that text content,
     * and resets it after a timeout (see below for why). We do the same thing here,
     * but in a way that fits into Lit's lifecycle.
     *
     * TODO(aomarks) Investigate whether this can be simplified; but to do that we
     * first need testing infrastructure to verify that it remains compatible with
     * screen readers. For example, can we just create an entirely new label node
     * every time we open or labelText changes? If not, and the async text/::before
     * swap is strictly required, can we at elast make this directive more generic
     * (e.g. so that we don't hard-code the name of the label class).
     */
    const accessibleSnackbarLabel = directive((labelText, isOpen) => (part) => {
        if (!isOpen) {
            // We never need to do anything if we're closed, even if the label also
            // changed in this batch of changes. We'll fully reset the label text
            // whenever we next open.
            return;
        }
        let maybeState = stateMap.get(part);
        if (maybeState === undefined) {
            // Create the label element once, the first time we open.
            const labelEl = document.createElement('div');
            labelEl.setAttribute('class', 'mdc-snackbar__label');
            labelEl.setAttribute('role', 'status');
            labelEl.setAttribute('aria-live', 'polite');
            labelEl.textContent = labelText;
            // endNode can't be a Document, so it must have a parent.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            part.endNode.parentNode.insertBefore(labelEl, part.endNode);
            maybeState = {
                labelEl,
                timerId: null,
            };
            stateMap.set(part, maybeState);
            // No need to do anything more for ARIA the first time we open. We just
            // created the element with the current label, so screen readers will
            // detect it fine.
            return;
        }
        const state = maybeState;
        const labelEl = state.labelEl;
        // Temporarily disable `aria-live` to prevent JAWS+Firefox from announcing
        // the message twice.
        labelEl.setAttribute('aria-live', 'off');
        // Temporarily clear `textContent` to force a DOM mutation event that will
        // be detected by screen readers. `aria-live` elements are only announced
        // when the element's `textContent` *changes*, so snackbars sent to the
        // browser in the initial HTML response won't be read unless we clear the
        // element's `textContent` first. Similarly, displaying the same snackbar
        // message twice in a row doesn't trigger a DOM mutation event, so screen
        // readers won't announce the second message unless we first clear
        // `textContent`.
        //
        // We have to clear the label text two different ways to make it work in
        // all browsers and screen readers:
        //
        //   1. `textContent = ''` is required for IE11 + JAWS
        //   2. `innerHTML = '&nbsp;'` is required for Chrome + JAWS and NVDA
        //
        // All other browser/screen reader combinations support both methods.
        //
        // The wrapper `<span>` visually hides the space character so that it
        // doesn't cause jank when added/removed. N.B.: Setting `position:
        // absolute`, `opacity: 0`, or `height: 0` prevents Chrome from detecting
        // the DOM change.
        //
        // This technique has been tested in:
        //
        //   * JAWS 2019:
        //       - Chrome 70
        //       - Firefox 60 (ESR)
        //       - IE 11
        //   * NVDA 2018:
        //       - Chrome 70
        //       - Firefox 60 (ESR)
        //       - IE 11
        //   * ChromeVox 53
        labelEl.textContent = '';
        labelEl.innerHTML =
            '<span style="display: inline-block; width: 0; height: 1px;">' +
                '&nbsp;</span>';
        // Prevent visual jank by temporarily displaying the label text in the
        // ::before pseudo-element. CSS generated content is normally announced by
        // screen readers (except in IE 11; see
        // https://tink.uk/accessibility-support-for-css-generated-content/);
        // however, `aria-live` is turned off, so this DOM update will be ignored
        // by screen readers.
        labelEl.setAttribute(ARIA_LIVE_LABEL_TEXT_ATTR, labelText);
        if (state.timerId !== null) {
            // We hadn't yet swapped the textContent back in since the last time we
            // opened or changed the label. Cancel that task so we don't clobber the
            // new label.
            clearTimeout(state.timerId);
        }
        state.timerId = window.setTimeout(() => {
            state.timerId = null;
            // Allow screen readers to announce changes to the DOM again.
            labelEl.setAttribute('aria-live', 'polite');
            // Remove the message from the ::before pseudo-element.
            labelEl.removeAttribute(ARIA_LIVE_LABEL_TEXT_ATTR);
            // Restore the original label text, which will be announced by
            // screen readers.
            labelEl.textContent = labelText;
        }, ARIA_LIVE_DELAY_MS);
    });

    const { OPENING_EVENT, OPENED_EVENT, CLOSING_EVENT, CLOSED_EVENT, } = MDCSnackbarFoundation.strings;
    class SnackbarBase extends BaseElement {
        constructor() {
            super(...arguments);
            this.mdcFoundationClass = MDCSnackbarFoundation;
            this.open = false;
            this.timeoutMs = 5000;
            this.closeOnEscape = false;
            this.labelText = '';
            this.stacked = false;
            this.leading = false;
            this.reason = '';
        }
        render() {
            const classes = {
                'mdc-snackbar--stacked': this.stacked,
                'mdc-snackbar--leading': this.leading,
            };
            return html `
      <div class="mdc-snackbar ${classMap(classes)}" @keydown="${this._handleKeydown}">
        <div class="mdc-snackbar__surface">
          ${accessibleSnackbarLabel(this.labelText, this.open)}
          <div class="mdc-snackbar__actions">
            <slot name="action" @click="${this._handleActionClick}"></slot>
            <slot name="dismiss" @click="${this._handleDismissClick}"></slot>
          </div>
        </div>
      </div>`;
        }
        createAdapter() {
            return Object.assign(Object.assign({}, addHasRemoveClass(this.mdcRoot)), { announce: () => {
                    /* We handle announce ourselves with the accessible directive. */
                }, notifyClosed: (reason) => {
                    this.dispatchEvent(new CustomEvent(CLOSED_EVENT, { bubbles: true, cancelable: true, detail: { reason: reason } }));
                }, notifyClosing: (reason) => {
                    this.open = false;
                    this.dispatchEvent(new CustomEvent(CLOSING_EVENT, { bubbles: true, cancelable: true, detail: { reason: reason } }));
                }, notifyOpened: () => {
                    this.dispatchEvent(new CustomEvent(OPENED_EVENT, { bubbles: true, cancelable: true }));
                }, notifyOpening: () => {
                    this.open = true;
                    this.dispatchEvent(new CustomEvent(OPENING_EVENT, { bubbles: true, cancelable: true }));
                } });
        }
        /** @export */
        show() {
            this.open = true;
        }
        /** @export */
        close(reason = '') {
            this.reason = reason;
            this.open = false;
        }
        firstUpdated() {
            super.firstUpdated();
            if (this.open) {
                this.mdcFoundation.open();
            }
        }
        _handleKeydown(e) {
            this.mdcFoundation.handleKeyDown(e);
        }
        _handleActionClick(e) {
            this.mdcFoundation.handleActionButtonClick(e);
        }
        _handleDismissClick(e) {
            this.mdcFoundation.handleActionIconClick(e);
        }
    }
    __decorate([
        query('.mdc-snackbar')
    ], SnackbarBase.prototype, "mdcRoot", void 0);
    __decorate([
        query('.mdc-snackbar__label')
    ], SnackbarBase.prototype, "labelElement", void 0);
    __decorate([
        property({ type: Boolean, reflect: true }),
        observer(function (value) {
            if (this.mdcFoundation) {
                if (value) {
                    this.mdcFoundation.open();
                }
                else {
                    this.mdcFoundation.close(this.reason);
                    this.reason = '';
                }
            }
        })
    ], SnackbarBase.prototype, "open", void 0);
    __decorate([
        observer(function (value) {
            this.mdcFoundation.setTimeoutMs(value);
        }),
        property({ type: Number })
    ], SnackbarBase.prototype, "timeoutMs", void 0);
    __decorate([
        observer(function (value) {
            this.mdcFoundation.setCloseOnEscape(value);
        }),
        property({ type: Boolean })
    ], SnackbarBase.prototype, "closeOnEscape", void 0);
    __decorate([
        property({ type: String })
    ], SnackbarBase.prototype, "labelText", void 0);
    __decorate([
        property({ type: Boolean })
    ], SnackbarBase.prototype, "stacked", void 0);
    __decorate([
        property({ type: Boolean })
    ], SnackbarBase.prototype, "leading", void 0);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$8 = css `.mdc-snackbar{z-index:8;margin:8px;display:none;position:fixed;right:0;bottom:0;left:0;align-items:center;justify-content:center;box-sizing:border-box;pointer-events:none;-webkit-tap-highlight-color:rgba(0,0,0,0)}.mdc-snackbar__surface{background-color:#333333}.mdc-snackbar__label{color:rgba(255, 255, 255, 0.87)}.mdc-snackbar__surface{min-width:344px}@media(max-width: 480px),(max-width: 344px){.mdc-snackbar__surface{min-width:100%}}.mdc-snackbar__surface{max-width:672px}.mdc-snackbar__surface{box-shadow:0px 3px 5px -1px rgba(0, 0, 0, 0.2),0px 6px 10px 0px rgba(0, 0, 0, 0.14),0px 1px 18px 0px rgba(0,0,0,.12)}.mdc-snackbar__surface{border-radius:4px;border-radius:var(--mdc-shape-small, 4px)}.mdc-snackbar--opening,.mdc-snackbar--open,.mdc-snackbar--closing{display:flex}.mdc-snackbar--open .mdc-snackbar__label,.mdc-snackbar--open .mdc-snackbar__actions{visibility:visible}.mdc-snackbar--leading{justify-content:flex-start}.mdc-snackbar--stacked .mdc-snackbar__label{padding-left:16px;padding-right:8px;padding-bottom:12px}[dir=rtl] .mdc-snackbar--stacked .mdc-snackbar__label,.mdc-snackbar--stacked .mdc-snackbar__label[dir=rtl]{padding-left:8px;padding-right:16px}.mdc-snackbar--stacked .mdc-snackbar__surface{flex-direction:column;align-items:flex-start}.mdc-snackbar--stacked .mdc-snackbar__actions{align-self:flex-end;margin-bottom:8px}.mdc-snackbar__surface{padding-left:0;padding-right:8px;display:flex;align-items:center;justify-content:flex-start;box-sizing:border-box;transform:scale(0.8);opacity:0}[dir=rtl] .mdc-snackbar__surface,.mdc-snackbar__surface[dir=rtl]{padding-left:8px;padding-right:0}.mdc-snackbar--open .mdc-snackbar__surface{transform:scale(1);opacity:1;pointer-events:auto;transition:opacity 150ms 0ms cubic-bezier(0, 0, 0.2, 1),transform 150ms 0ms cubic-bezier(0, 0, 0.2, 1)}.mdc-snackbar--closing .mdc-snackbar__surface{transform:scale(1);transition:opacity 75ms 0ms cubic-bezier(0.4, 0, 1, 1)}.mdc-snackbar__label{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-body2-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.875rem;font-size:var(--mdc-typography-body2-font-size, 0.875rem);line-height:1.25rem;line-height:var(--mdc-typography-body2-line-height, 1.25rem);font-weight:400;font-weight:var(--mdc-typography-body2-font-weight, 400);letter-spacing:0.0178571429em;letter-spacing:var(--mdc-typography-body2-letter-spacing, 0.0178571429em);text-decoration:inherit;text-decoration:var(--mdc-typography-body2-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-body2-text-transform, inherit);padding-left:16px;padding-right:8px;width:100%;flex-grow:1;box-sizing:border-box;margin:0;visibility:hidden;padding-top:14px;padding-bottom:14px}[dir=rtl] .mdc-snackbar__label,.mdc-snackbar__label[dir=rtl]{padding-left:8px;padding-right:16px}.mdc-snackbar__label::before{display:inline;content:attr(data-mdc-snackbar-label-text)}.mdc-snackbar__actions{display:flex;flex-shrink:0;align-items:center;box-sizing:border-box;visibility:hidden}.mdc-snackbar__action:not(:disabled){color:#bb86fc}.mdc-snackbar__action::before,.mdc-snackbar__action::after{background-color:#bb86fc;background-color:var(--mdc-ripple-color, #bb86fc)}.mdc-snackbar__action:hover::before,.mdc-snackbar__action.mdc-ripple-surface--hover::before{opacity:0.08;opacity:var(--mdc-ripple-hover-opacity, 0.08)}.mdc-snackbar__action.mdc-ripple-upgraded--background-focused::before,.mdc-snackbar__action:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-focus-opacity, 0.24)}.mdc-snackbar__action:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-snackbar__action:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-snackbar__action.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.24)}.mdc-snackbar__dismiss{color:rgba(255, 255, 255, 0.87)}.mdc-snackbar__dismiss::before,.mdc-snackbar__dismiss::after{background-color:rgba(255, 255, 255, 0.87);background-color:var(--mdc-ripple-color, rgba(255, 255, 255, 0.87))}.mdc-snackbar__dismiss:hover::before,.mdc-snackbar__dismiss.mdc-ripple-surface--hover::before{opacity:0.08;opacity:var(--mdc-ripple-hover-opacity, 0.08)}.mdc-snackbar__dismiss.mdc-ripple-upgraded--background-focused::before,.mdc-snackbar__dismiss:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-focus-opacity, 0.24)}.mdc-snackbar__dismiss:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-snackbar__dismiss:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-snackbar__dismiss.mdc-ripple-upgraded{--mdc-ripple-fg-opacity: var(--mdc-ripple-press-opacity, 0.24)}.mdc-snackbar__dismiss.mdc-snackbar__dismiss{width:36px;height:36px;padding:9px;font-size:18px}.mdc-snackbar__dismiss.mdc-snackbar__dismiss svg,.mdc-snackbar__dismiss.mdc-snackbar__dismiss img{width:18px;height:18px}.mdc-snackbar__action+.mdc-snackbar__dismiss{margin-left:8px;margin-right:0}[dir=rtl] .mdc-snackbar__action+.mdc-snackbar__dismiss,.mdc-snackbar__action+.mdc-snackbar__dismiss[dir=rtl]{margin-left:0;margin-right:8px}slot[name=action]::slotted(mwc-button){--mdc-theme-primary: var(--mdc-snackbar-action-color, #bb86fc)}slot[name=dismiss]::slotted(mwc-icon-button){--mdc-icon-size: 18px;--mdc-icon-button-size: 36px;color:rgba(255, 255, 255, 0.87);margin-left:8px;margin-right:0}[dir=rtl] slot[name=dismiss]::slotted(mwc-icon-button),slot[name=dismiss]::slotted(mwc-icon-button)[dir=rtl]{margin-left:0;margin-right:8px}`;

    let Snackbar = class Snackbar extends SnackbarBase {
    };
    Snackbar.styles = style$8;
    Snackbar = __decorate([
        customElement('mwc-snackbar')
    ], Snackbar);

    /** @soyCompatible */
    class CircularProgressBase extends LitElement {
        constructor() {
            super(...arguments);
            this.indeterminate = false;
            this.progress = 0;
            this.density = 0;
            this.closed = false;
            this.ariaLabel = '';
        }
        open() {
            this.closed = false;
        }
        close() {
            this.closed = true;
        }
        /**
         * @soyTemplate
         */
        render() {
            /** @classMap */
            const classes = {
                'mdc-circular-progress--closed': this.closed,
                'mdc-circular-progress--indeterminate': this.indeterminate,
            };
            const containerSideLength = 48 + this.density * 4;
            const styles = {
                'width': `${containerSideLength}px`,
                'height': `${containerSideLength}px`,
            };
            return html `
      <div
        class="mdc-circular-progress ${classMap(classes)}"
        style="${styleMap(styles)}"
        role="progressbar"
        aria-label="${this.ariaLabel}"
        aria-valuemin="0"
        aria-valuemax="1"
        aria-valuenow="${ifDefined(this.indeterminate ? undefined : this.progress)}">
        ${this.renderDeterminateContainer()}
        ${this.renderIndeterminateContainer()}
      </div>`;
        }
        /**
         * @soyTemplate
         */
        renderDeterminateContainer() {
            const sideLength = 48 + this.density * 4;
            const center = sideLength / 2;
            const circleRadius = this.density >= -3 ? 18 + this.density * 11 / 6 :
                12.5 + (this.density + 3) * 5 / 4;
            const circumference = 2 * 3.1415926 * circleRadius;
            const determinateStrokeDashOffset = (1 - this.progress) * circumference;
            const strokeWidth = this.density >= -3 ? 4 + this.density * (1 / 3) :
                3 + (this.density + 3) * (1 / 6);
            return html `
      <div class="mdc-circular-progress__determinate-container">
        <svg class="mdc-circular-progress__determinate-circle-graphic"
             viewBox="0 0 ${sideLength} ${sideLength}">
          <circle class="mdc-circular-progress__determinate-track"
                  cx="${center}" cy="${center}" r="${circleRadius}"
                  stroke-width="${strokeWidth}"></circle>
          <circle class="mdc-circular-progress__determinate-circle"
                  cx="${center}" cy="${center}" r="${circleRadius}"
                  stroke-dasharray="${2 * 3.1415926 * circleRadius}"
                  stroke-dashoffset="${determinateStrokeDashOffset}"
                  stroke-width="${strokeWidth}"></circle>
        </svg>
      </div>`;
        }
        /**
         * @soyTemplate
         */
        renderIndeterminateContainer() {
            return html `
      <div class="mdc-circular-progress__indeterminate-container">
        <div class="mdc-circular-progress__spinner-layer">
          ${this.renderIndeterminateSpinnerLayer()}
        </div>
      </div>`;
        }
        /**
         * @soyTemplate
         */
        renderIndeterminateSpinnerLayer() {
            const sideLength = 48 + this.density * 4;
            const center = sideLength / 2;
            const circleRadius = this.density >= -3 ? 18 + this.density * 11 / 6 :
                12.5 + (this.density + 3) * 5 / 4;
            const circumference = 2 * 3.1415926 * circleRadius;
            const halfCircumference = 0.5 * circumference;
            const strokeWidth = this.density >= -3 ? 4 + this.density * (1 / 3) :
                3 + (this.density + 3) * (1 / 6);
            return html `
        <div class="mdc-circular-progress__circle-clipper mdc-circular-progress__circle-left">
          <svg class="mdc-circular-progress__indeterminate-circle-graphic"
               viewBox="0 0 ${sideLength} ${sideLength}">
            <circle cx="${center}" cy="${center}" r="${circleRadius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${halfCircumference}"
                    stroke-width="${strokeWidth}"></circle>
          </svg>
        </div>
        <div class="mdc-circular-progress__gap-patch">
          <svg class="mdc-circular-progress__indeterminate-circle-graphic"
               viewBox="0 0 ${sideLength} ${sideLength}">
            <circle cx="${center}" cy="${center}" r="${circleRadius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${halfCircumference}"
                    stroke-width="${strokeWidth * 0.8}"></circle>
          </svg>
        </div>
        <div class="mdc-circular-progress__circle-clipper mdc-circular-progress__circle-right">
          <svg class="mdc-circular-progress__indeterminate-circle-graphic"
               viewBox="0 0 ${sideLength} ${sideLength}">
            <circle cx="${center}" cy="${center}" r="${circleRadius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${halfCircumference}"
                    stroke-width="${strokeWidth}"></circle>
          </svg>
        </div>`;
        }
        update(changedProperties) {
            super.update(changedProperties);
            // Bound progress value in interval [0, 1].
            if (changedProperties.has('progress')) {
                if (this.progress > 1) {
                    this.progress = 1;
                }
                if (this.progress < 0) {
                    this.progress = 0;
                }
            }
        }
    }
    __decorate([
        property({ type: Boolean, reflect: true })
    ], CircularProgressBase.prototype, "indeterminate", void 0);
    __decorate([
        property({ type: Number, reflect: true })
    ], CircularProgressBase.prototype, "progress", void 0);
    __decorate([
        property({ type: Number, reflect: true })
    ], CircularProgressBase.prototype, "density", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], CircularProgressBase.prototype, "closed", void 0);
    __decorate([
        property({ type: String })
    ], CircularProgressBase.prototype, "ariaLabel", void 0);

    /**
    @license
    Copyright 2018 Google Inc. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    */
    const style$9 = css `.mdc-circular-progress__determinate-circle,.mdc-circular-progress__indeterminate-circle-graphic{stroke:#6200ee;stroke:var(--mdc-theme-primary, #6200ee)}.mdc-circular-progress__determinate-track{stroke:transparent}@keyframes mdc-circular-progress-container-rotate{to{transform:rotate(360deg)}}@keyframes mdc-circular-progress-spinner-layer-rotate{12.5%{transform:rotate(135deg)}25%{transform:rotate(270deg)}37.5%{transform:rotate(405deg)}50%{transform:rotate(540deg)}62.5%{transform:rotate(675deg)}75%{transform:rotate(810deg)}87.5%{transform:rotate(945deg)}100%{transform:rotate(1080deg)}}@keyframes mdc-circular-progress-color-1-fade-in-out{from{opacity:.99}25%{opacity:.99}26%{opacity:0}89%{opacity:0}90%{opacity:.99}to{opacity:.99}}@keyframes mdc-circular-progress-color-2-fade-in-out{from{opacity:0}15%{opacity:0}25%{opacity:.99}50%{opacity:.99}51%{opacity:0}to{opacity:0}}@keyframes mdc-circular-progress-color-3-fade-in-out{from{opacity:0}40%{opacity:0}50%{opacity:.99}75%{opacity:.99}76%{opacity:0}to{opacity:0}}@keyframes mdc-circular-progress-color-4-fade-in-out{from{opacity:0}65%{opacity:0}75%{opacity:.99}90%{opacity:.99}to{opacity:0}}@keyframes mdc-circular-progress-left-spin{from{transform:rotate(265deg)}50%{transform:rotate(130deg)}to{transform:rotate(265deg)}}@keyframes mdc-circular-progress-right-spin{from{transform:rotate(-265deg)}50%{transform:rotate(-130deg)}to{transform:rotate(-265deg)}}.mdc-circular-progress{display:inline-flex;position:relative;direction:ltr;transition:opacity 250ms 0ms cubic-bezier(0.4, 0, 0.6, 1)}.mdc-circular-progress__determinate-container,.mdc-circular-progress__indeterminate-circle-graphic,.mdc-circular-progress__indeterminate-container,.mdc-circular-progress__spinner-layer{position:absolute;width:100%;height:100%}.mdc-circular-progress__determinate-container{transform:rotate(-90deg)}.mdc-circular-progress__indeterminate-container{font-size:0;letter-spacing:0;white-space:nowrap;opacity:0}.mdc-circular-progress__determinate-circle-graphic,.mdc-circular-progress__indeterminate-circle-graphic{fill:transparent}.mdc-circular-progress__determinate-circle{transition:stroke-dashoffset 500ms 0ms cubic-bezier(0, 0, 0.2, 1)}.mdc-circular-progress__gap-patch{position:absolute;top:0;left:47.5%;box-sizing:border-box;width:5%;height:100%;overflow:hidden}.mdc-circular-progress__gap-patch .mdc-circular-progress__indeterminate-circle-graphic{left:-900%;width:2000%;transform:rotate(180deg)}.mdc-circular-progress__circle-clipper{display:inline-flex;position:relative;width:50%;height:100%;overflow:hidden}.mdc-circular-progress__circle-clipper .mdc-circular-progress__indeterminate-circle-graphic{width:200%}.mdc-circular-progress__circle-right .mdc-circular-progress__indeterminate-circle-graphic{left:-100%}.mdc-circular-progress--indeterminate .mdc-circular-progress__determinate-container{opacity:0}.mdc-circular-progress--indeterminate .mdc-circular-progress__indeterminate-container{opacity:1}.mdc-circular-progress--indeterminate .mdc-circular-progress__indeterminate-container{animation:mdc-circular-progress-container-rotate 1568.2352941176ms linear infinite}.mdc-circular-progress--indeterminate .mdc-circular-progress__spinner-layer{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-1{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-1-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-2{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-2-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-3{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-3-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-4{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-4-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__circle-left .mdc-circular-progress__indeterminate-circle-graphic{animation:mdc-circular-progress-left-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__circle-right .mdc-circular-progress__indeterminate-circle-graphic{animation:mdc-circular-progress-right-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--closed{opacity:0}:host{display:inline-flex}.mdc-circular-progress__determinate-track{stroke:transparent;stroke:var(--mdc-circular-progress-track-color, transparent)}`;

    /** @soyCompatible */
    let CircularProgress = class CircularProgress extends CircularProgressBase {
    };
    CircularProgress.styles = style$9;
    CircularProgress = __decorate([
        customElement('mwc-circular-progress')
    ], CircularProgress);

    /**
     * @license
     * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
     * This code may only be used under the BSD style license found at
     * http://polymer.github.io/LICENSE.txt
     * The complete set of authors may be found at
     * http://polymer.github.io/AUTHORS.txt
     * The complete set of contributors may be found at
     * http://polymer.github.io/CONTRIBUTORS.txt
     * Code distributed by Google as part of the polymer project is also
     * subject to an additional IP rights grant found at
     * http://polymer.github.io/PATENTS.txt
     */
    // For each part, remember the value that was last rendered to the part by the
    // unsafeHTML directive, and the DocumentFragment that was last set as a value.
    // The DocumentFragment is used as a unique key to check if the last value
    // rendered to the part was with unsafeHTML. If not, we'll always re-render the
    // value passed to unsafeHTML.
    const previousValues$1 = new WeakMap();
    /**
     * Renders the result as HTML, rather than text.
     *
     * Note, this is unsafe to use with any user-provided input that hasn't been
     * sanitized or escaped, as it may lead to cross-site-scripting
     * vulnerabilities.
     */
    const unsafeHTML = directive((value) => (part) => {
        if (!(part instanceof NodePart)) {
            throw new Error('unsafeHTML can only be used in text bindings');
        }
        const previousValue = previousValues$1.get(part);
        if (previousValue !== undefined && isPrimitive(value) &&
            value === previousValue.value && part.value === previousValue.fragment) {
            return;
        }
        const template = document.createElement('template');
        template.innerHTML = value; // innerHTML casts to string internally
        const fragment = document.importNode(template.content, true);
        part.setValue(fragment);
        previousValues$1.set(part, { value, fragment });
    });

    let HanjaMetadatasDialog = class HanjaMetadatasDialog extends Dialog {
        render() {
            if (this.metadatas) {
                this.heading = exports.app.revealed ? this.metadatas.s : 'metadatas';
                render(html `
      <div style="margin: 7px 0 15px;">${this.metadatas.e}</div>
      ${this.metadatas.p.map((p, i) => {
                return html `
        <div style="margin:0 0 15px 0;">
          <div>${i + 1}. <b>${p.t}</b></div>
          <div style="padding: 5px 10px 0;white-space: break-spaces;">${unsafeHTML(p.k)}</div>
        </div>
        `;
            })}
      <mwc-button slot="primaryAction" dialogAction="close">close</mwc-button>
    `, this);
            }
            return super.render();
        }
    };
    __decorate([
        property({ type: Object })
    ], HanjaMetadatasDialog.prototype, "metadatas", void 0);
    HanjaMetadatasDialog = __decorate([
        customElement('hanja-metadatas-dialog')
    ], HanjaMetadatasDialog);

    let SnackbarButton = class SnackbarButton extends Button {
    };
    SnackbarButton.styles = [
        Button.styles,
        css `
    .mdc-button__icon {
      margin-right: 0 !important;
    }
    `
    ];
    SnackbarButton = __decorate([
        customElement('snackbar-button')
    ], SnackbarButton);

    class RepeatList extends Array {
        constructor(...items) {
            super(...items);
            this.load();
        }
        push(...items) {
            const ret = super.push(...items);
            this.updateSettings();
            this.save();
            return ret;
        }
        load() {
            this.reset();
            if (localStorage.getItem('repeatList')) {
                super.push(...JSON.parse(localStorage.getItem('repeatList').toString()));
            }
        }
        save() {
            localStorage.setItem('repeatList', JSON.stringify(this));
        }
        reset() {
            this.length = 0;
            this.updateSettings();
            this.updateApp();
        }
        async updateSettings() {
            try {
                settings.requestUpdate();
            }
            catch (e) { }
        }
        async updateApp() {
            try {
                exports.app.requestUpdate();
            }
            catch (e) {
            }
        }
    }
    let repeatList = new RepeatList;

    let SettingsManager = class SettingsManager extends LitElement {
        constructor() {
            super();
            this.repeat = true;
            this.repeatEvery = 2;
            this.repeatLength = 1;
            this.repeatOnly = false;
            this.load();
        }
        render() {
            return html `
    <mwc-dialog id="settingsDialog" heading="Settings"
      @opened="${() => this.shadowRoot.querySelectorAll('mwc-slider').forEach(s => s.layout())}"> 
      <div>
        <div class="setting-item">
          <mwc-formfield label="Repeat hanjas">
            <mwc-checkbox ?checked="${this.repeat}"
              @change="${e => this.repeat = e.target.checked}"></mwc-checkbox>
          </mwc-formfield>
          <div class="desc">Repeat hanjas you've already encountered.</div>
        </div>

        <div class="setting-item">
          <mwc-slider step="1" min="1" max="10" markers pin
            ?disabled="${!this.repeat || this.repeatOnly}"
            style="width:100%"
            value="${this.repeatEvery}"
            @input="${e => this.repeatEvery = e.detail.value}"></mwc-slider>          
          <div class="desc">Every : ${this.repeatEvery} hanjas.</div>
        </div>

        <div class="setting-item">
          <mwc-slider step="1" min="1" max="${repeatList.length < 5 ? 5 : repeatList.length}" markers pin
            ?disabled="${!this.repeat || this.repeatOnly}"
            style="width:100%"
            value="${this.repeatLength}"
            @input="${e => this.repeatLength = e.detail.value}"></mwc-slider>          
          <div class="desc">Length: repeat ${this.repeatLength} hanjas.</div>
        </div>

        <div style="margin:0 20px;">
          <div class="setting-item">
            <mwc-formfield label="Repeat only">
              <mwc-checkbox
                ?checked="${this.repeatOnly}"
                ?disabled="${!this.repeat || repeatList.length < 3}"
                @change="${e => this.repeatOnly = e.target.checked}"
              ></mwc-checkbox>
            </mwc-formfield>
            <div class="desc">New hanjas won't be proposed, only already encountered hanjas.<br>
            ${repeatList.length < 3 ? `Requires at least 3 hanjas in the bag. (${repeatList.length}/3)` : nothing}</div>
          </div>
        </div>
      </div>

      <mwc-button unelevated slot="secondaryAction"
        style="--mdc-theme-primary: #ef5350"
        @click="${this.clearCache}">clear cache</mwc-button>
      <mwc-button slot="primaryAction" dialogAction="close">close</mwc-button>
    </mwc-dialog>
    `;
        }
        updated(_changedProperties) {
            this.save();
            // update to new properties
            for (const prop of _changedProperties) {
                _changedProperties.set(prop[0], this[prop[0]]);
            }
            // when settings are updated we should fire an event
            this.dispatchEvent(new CustomEvent('update', {
                detail: _changedProperties
            }));
        }
        show() {
            this.settingsDialog.show();
        }
        save() {
            const settings = {
                repeat: this.repeat,
                repeatEvery: this.repeatEvery,
                repeatLength: this.repeatLength,
                repeatOnly: this.repeatOnly,
            };
            localStorage.setItem('settings', JSON.stringify(settings));
            // console.log('settings saved')
        }
        load() {
            if (localStorage.getItem('settings')) {
                const settings = JSON.parse(localStorage.getItem('settings'));
                this.repeat = settings.repeat;
                this.repeatEvery = settings.repeatEvery;
                this.repeatLength = settings.repeatLength;
                this.repeatOnly = settings.repeatOnly;
                this.adjustRepeatLength();
            }
        }
        clearCache() {
            exports.app.clearCache();
            this.repeatOnly = false;
            this.adjustRepeatLength();
            // this.save();
        }
        adjustRepeatLength() {
            if (this.repeatLength > 5 && this.repeatLength > repeatList.length) {
                this.repeatLength = 5;
                this.save();
            }
        }
    };
    SettingsManager.styles = css `
    .setting-item .desc {
      font-size: 13px;
      padding: 0 20px 0 53px; 
      border-sizing: border-box;
      position: relative;
      top: -7px;
      color: grey;
    }

    mwc-slider {
      width: 100%;
      padding: 0 25px;
      box-sizing: border-box;
    }
  `;
    __decorate([
        property({ type: Boolean })
    ], SettingsManager.prototype, "repeat", void 0);
    __decorate([
        property({ type: Number })
    ], SettingsManager.prototype, "repeatEvery", void 0);
    __decorate([
        property({ type: Number })
    ], SettingsManager.prototype, "repeatLength", void 0);
    __decorate([
        property({ type: Boolean })
    ], SettingsManager.prototype, "repeatOnly", void 0);
    __decorate([
        query('#settingsDialog')
    ], SettingsManager.prototype, "settingsDialog", void 0);
    SettingsManager = __decorate([
        customElement('settings-manager')
    ], SettingsManager);
    const settings = new SettingsManager;

    var data = [
    	{
    		t: "平",
    		m: "flat/level/equal // calm/peaceful//equal//to tie (to make the same score)/to draw (score)"
    	},
    	{
    		t: "來",
    		m: "to come / to arrive // from",
    		s: "来"
    	},
    	{
    		t: "大",
    		m: "big/huge/large // great // older // major"
    	},
    	{
    		t: "地",
    		m: "earth/ground/place | -ly"
    	},
    	{
    		t: "方",
    		m: "square // place // direction/side // method // prescription (medicine) // just when / only or just"
    	},
    	{
    		t: "告",
    		m: "to tell / to inform // to say"
    	},
    	{
    		t: "選",
    		m: "to choose / to pick / to select",
    		s: "选"
    	},
    	{
    		t: "宣",
    		m: "declare/announce"
    	},
    	{
    		t: "舉",
    		m: "to raise / to lift / to elect //to cite/to enumerate//act/move",
    		s: "举"
    	},
    	{
    		t: "現",
    		m: "to appear // present",
    		s: "现"
    	},
    	{
    		t: "顯",
    		m: "prominent/conspicuous",
    		s: "显"
    	},
    	{
    		t: "明",
    		m: "bright/clear"
    	},
    	{
    		t: "示",
    		m: "to show // to reveal"
    	},
    	{
    		t: "時",
    		m: "time // hour // period",
    		s: "时"
    	},
    	{
    		t: "即",
    		m: "prompt / at present //to approach//even if"
    	},
    	{
    		t: "役",
    		m: "role/task//corvée"
    	},
    	{
    		t: "割",
    		m: "to cut (apart)"
    	},
    	{
    		t: "原",
    		m: "former/original // raw // cause/source"
    	},
    	{
    		t: "本",
    		m: "root/origin/source//classifier for books, periodicals, files, etc..."
    	},
    	{
    		t: "義",
    		m: "justice/righteousness // meaning",
    		s: "义"
    	},
    	{
    		t: "權",
    		m: "authority/power/right",
    		s: "权"
    	},
    	{
    		t: "利",
    		m: "benefit/profit/advantage // favorable // sharp"
    	},
    	{
    		t: "立",
    		m: "to stand / to set up / to establish /  to lay down // at once / immediately"
    	},
    	{
    		t: "法",
    		m: "law/method/way/legalist"
    	},
    	{
    		t: "律",
    		m: "law"
    	},
    	{
    		t: "政",
    		m: "political/politics//government"
    	},
    	{
    		t: "建",
    		m: "to establish / to build / to set up / to construct / to found"
    	},
    	{
    		t: "定",
    		m: "to set / to fix // to determine / to decide // to order"
    	},
    	{
    		t: "正",
    		m: "regular//just/right/correct // straight/upright // positive / greater than zero // serious"
    	},
    	{
    		t: "規",
    		m: "a rule / regulation / to plan / to scheme //compass",
    		s: "规"
    	},
    	{
    		t: "意",
    		m: "meaning // idea / thought / to think // wish / desire // intention"
    	},
    	{
    		t: "味",
    		m: "taste / smell // classifier for drugs (in tcm)"
    	},
    	{
    		t: "視",
    		m: "to look at / to regard / to inspect",
    		s: "视"
    	},
    	{
    		t: "重",
    		m: "heavy//serious/important//to attach importance to|to repeat//repetition//again/re-"
    	},
    	{
    		t: "速",
    		m: "fast/rapid/quick//velocity"
    	},
    	{
    		t: "報",
    		m: "to announce / to inform // report / newspaper // recompense // revenge",
    		s: "报"
    	},
    	{
    		t: "度",
    		m: "degree / intensity // extent/limit/measure"
    	},
    	{
    		t: "偉",
    		m: "big/large/great",
    		s: "伟"
    	},
    	{
    		t: "搜",
    		m: "to search"
    	},
    	{
    		t: "查",
    		m: "to research / to check / to investigate / to examine "
    	},
    	{
    		t: "揮",
    		m: "to wave / to brandish / to scatter / to disperse // to command / to conduct",
    		s: "挥"
    	},
    	{
    		t: "員",
    		m: "person // member // employee",
    		s: "员"
    	},
    	{
    		t: "店",
    		m: "inn/shop/store"
    	},
    	{
    		t: "製",
    		m: "to manufacture / to make",
    		s: "制"
    	},
    	{
    		t: "壓",
    		m: "to press / to push down / to keep under control",
    		s: "压"
    	},
    	{
    		t: "精",
    		m: "essence/extract/semen // vitality/energy/spirit // highly perfected / proficient / extremely (fine) // goblin"
    	},
    	{
    		t: "神",
    		m: "mysterious/unusual // god/deity // soul/spirit // amazing/awesome"
    	},
    	{
    		t: "疾",
    		m: "sickness/disease/hate/envy"
    	},
    	{
    		t: "患",
    		m: "to suffer / to contract (a disease) / misfortune"
    	},
    	{
    		t: "恐",
    		m: "afraid / frightened // to fear"
    	},
    	{
    		t: "慌",
    		m: "to get panicky / to lose one's head"
    	},
    	{
    		t: "前",
    		m: "front/forward/ahead/first/top//before/ago/former"
    	},
    	{
    		t: "歷",
    		m: "to experience / to undergo / to pass through // history",
    		s: "历"
    	},
    	{
    		t: "識",
    		m: "knowledge // to know",
    		s: "识"
    	},
    	{
    		t: "化",
    		m: "to make into / to transform / to ...-ize"
    	},
    	{
    		t: "極",
    		m: "extremely/pole/utmost",
    		s: "极"
    	},
    	{
    		t: "端",
    		m: "end/extremity // item // regular"
    	},
    	{
    		t: "傳",
    		m: "to transmit / to transfer / to pass on // to spread // to infect | biography",
    		s: "传"
    	},
    	{
    		t: "提",
    		m: "to lift / to raise (an issue) // to put forward / to mention"
    	},
    	{
    		t: "情",
    		m: "feeling/emotion // passion // situation"
    	},
    	{
    		t: "展",
    		m: "to spread out / to open up / to exhibit // to develop / to put into effect"
    	},
    	{
    		t: "婦",
    		m: "woman",
    		s: "妇"
    	},
    	{
    		t: "安",
    		m: "content/calm/still/quiet // safe"
    	},
    	{
    		t: "慰",
    		m: "to comfort / to console / to reassure"
    	},
    	{
    		t: "人",
    		m: "man/person/people"
    	},
    	{
    		t: "別",
    		m: "to leave / to depart // to separate // to distinguish / to classify",
    		s: "别"
    	},
    	{
    		t: "訪",
    		m: "to visit // to call on // to investigate",
    		s: "访"
    	},
    	{
    		t: "題",
    		m: "topic / problem for discussion / exam question / subject",
    		s: "题"
    	},
    	{
    		t: "問",
    		m: "to ask",
    		s: "问"
    	},
    	{
    		t: "止",
    		m: "to stop / to prohibit//until"
    	},
    	{
    		t: "點",
    		m: "point/dot/drop // cure//o'clock",
    		s: "点"
    	},
    	{
    		t: "停",
    		m: "to stop / to halt // to park (a car)"
    	},
    	{
    		t: "性",
    		m: "sex/gender // nature/character // attribute/property/quality // -ity"
    	},
    	{
    		t: "差",
    		m: "difference / discrepancy / to differ"
    	},
    	{
    		t: "輪",
    		m: "wheel//disk/ring/round",
    		s: "轮"
    	},
    	{
    		t: "廓",
    		m: "empty/open/big"
    	},
    	{
    		t: "熟",
    		m: "ripe/mature // skilled // done"
    	},
    	{
    		t: "練",
    		m: "to practice / to train / to perfect",
    		s: "练"
    	},
    	{
    		t: "收",
    		m: "to receive / to accept / to collect"
    	},
    	{
    		t: "死",
    		m: "to die"
    	},
    	{
    		t: "卽",
    		m: "variant of 即"
    	},
    	{
    		t: "植",
    		m: "to plant"
    	},
    	{
    		t: "物",
    		m: "thing/object/matter"
    	},
    	{
    		t: "很",
    		m: "quite/very/awfully"
    	},
    	{
    		t: "生",
    		m: "to be born // to grow / to live // to give birth // life // raw/uncooked // student"
    	},
    	{
    		t: "一",
    		m: "one/single // all // as soon as"
    	},
    	{
    		t: "持",
    		m: "to hold / to keep / to grasp / to maintain // to support // to persevere"
    	},
    	{
    		t: "續",
    		m: "to join // to continue / to replenish",
    		s: "续"
    	},
    	{
    		t: "同",
    		m: "like/same/similar // together/with"
    	},
    	{
    		t: "伴",
    		m: "partner/companion/comrade/associate"
    	},
    	{
    		t: "見",
    		m: "to see // to receive / to interview // to appear (to be sth) | to appear",
    		s: "见"
    	},
    	{
    		t: "妖",
    		m: "goblin/witch/monster/phantom/demon"
    	},
    	{
    		t: "稀",
    		m: "rare/uncommon/sparse//watery"
    	},
    	{
    		t: "貴",
    		m: "expensive//precious // noble",
    		s: "贵"
    	},
    	{
    		t: "名",
    		m: "name // famous // classifier for people"
    	},
    	{
    		t: "成",
    		m: "to become / to turn into//to succeed / to finish / to complete / to accomplish // ok!"
    	},
    	{
    		t: "長",
    		m: "chief/head // to grow / to develop / to increase / to enhance | length//long",
    		s: "长"
    	},
    	{
    		t: "魔",
    		m: "magic/devil"
    	},
    	{
    		t: "格",
    		m: "formality/standard //rule/(legal) case // square/frame // style//character"
    	},
    	{
    		t: "價",
    		m: "price // value",
    		s: "价"
    	},
    	{
    		t: "攻",
    		m: "to attack//to study"
    	},
    	{
    		t: "掠",
    		m: "to take over by force / to rob / to plunder"
    	},
    	{
    		t: "始",
    		m: "to start / to begin"
    	},
    	{
    		t: "作",
    		m: "to do // to make (from operating) // to compose"
    	},
    	{
    		t: "有",
    		m: "to have // there is / there are//to exist/to be"
    	},
    	{
    		t: "民",
    		m: "the people / citizens"
    	},
    	{
    		t: "主",
    		m: "main//master//host"
    	},
    	{
    		t: "者",
    		m: "-er / -ist"
    	},
    	{
    		t: "難",
    		m: "disaster/distress // to scold | difficulty/difficult/problem",
    		s: "难"
    	},
    	{
    		t: "策",
    		m: "policy/plan/scheme/measure"
    	},
    	{
    		t: "救",
    		m: "to save / to rescue / to assist"
    	},
    	{
    		t: "助",
    		m: "to help / to assist"
    	},
    	{
    		t: "輿",
    		m: "world",
    		s: "舆"
    	},
    	{
    		t: "論",
    		m: "to discuss / to talk about / to argue // opinion/view/theory/doctrine // about",
    		s: "论"
    	},
    	{
    		t: "調",
    		m: "to investigate / to enquire into // tone/tune/accent // view/argument | to harmonize / to reconcile / to blend // to season (food)",
    		s: "调"
    	},
    	{
    		t: "共",
    		m: "common/general // together // to share"
    	},
    	{
    		t: "應",
    		m: "to answer/to respond//to deal with/to cope with|should/ought to/must/shall",
    		s: "应"
    	},
    	{
    		t: "答",
    		m: "reply/answer/response/echo"
    	},
    	{
    		t: "申",
    		m: "to state // to explain"
    	},
    	{
    		t: "請",
    		m: "to ask / to request // to invite",
    		s: "请"
    	},
    	{
    		t: "容",
    		m: "appearance/look/countenance // to allow / to tolerate // to hold / to contain"
    	},
    	{
    		t: "詳",
    		m: "detailed/comprehensive",
    		s: "详"
    	},
    	{
    		t: "細",
    		m: "thin/slender/fine/delicate",
    		s: "细"
    	},
    	{
    		t: "文",
    		m: "language/writing // culture"
    	},
    	{
    		t: "句",
    		m: "sentence/clause/phrase"
    	},
    	{
    		t: "市",
    		m: "city // market"
    	},
    	{
    		t: "兼",
    		m: "simultaneously/double/twice"
    	},
    	{
    		t: "事",
    		m: "work/affair // matter/situation //thing/item"
    	},
    	{
    		t: "記",
    		m: "to record / to note // to remember",
    		s: "记"
    	},
    	{
    		t: "邸",
    		m: "lodging-house"
    	},
    	{
    		t: "官",
    		m: "official/government // organ of body"
    	},
    	{
    		t: "興",
    		m: "feeling or desire to do sth / interest in sth // joy/fun/excitement",
    		s: "兴"
    	},
    	{
    		t: "趣",
    		m: "interesting // to interest"
    	},
    	{
    		t: "宮",
    		m: "palace/temple",
    		s: "宫"
    	},
    	{
    		t: "殿",
    		m: "palace hall"
    	},
    	{
    		t: "琉",
    		m: "precious stone"
    	},
    	{
    		t: "璃",
    		m: "colored glaze / glass"
    	},
    	{
    		t: "先",
    		m: "first / early / prior // in advance // former"
    	},
    	{
    		t: "於",
    		m: "at/in//from",
    		s: "于"
    	},
    	{
    		t: "侵",
    		m: "to encroach / to invade / to infringe / to approach"
    	},
    	{
    		t: "入",
    		m: "to enter / to go into / to join"
    	},
    	{
    		t: "如",
    		m: "(similar) as / as if / such as"
    	},
    	{
    		t: "險",
    		m: "danger/dangerous/rugged",
    		s: "险"
    	},
    	{
    		t: "希",
    		m: "to hope / to admire"
    	},
    	{
    		t: "望",
    		m: "to hope / to expect // to look towards / towards"
    	},
    	{
    		t: "因",
    		m: "cause/reason/because"
    	},
    	{
    		t: "心",
    		m: "heart/core/center // mind/intention"
    	},
    	{
    		t: "臟",
    		m: "(anatomy) organ",
    		s: "脏"
    	},
    	{
    		t: "麻",
    		m: "hemp//to feel numb//sesame"
    	},
    	{
    		t: "痺",
    		m: "paralysis/numbness",
    		s: "痹"
    	},
    	{
    		t: "決",
    		m: "to decide / to determine // definitely // to execute (sb)",
    		s: "决"
    	},
    	{
    		t: "勝",
    		m: "victory / success // to beat / to defeat",
    		s: "胜"
    	},
    	{
    		t: "戰",
    		m: "fight/war/battle // to fight",
    		s: "战"
    	},
    	{
    		t: "延",
    		m: "to prolong / to extend / to delay"
    	},
    	{
    		t: "許",
    		m: "to allow/to permit//somewhat",
    		s: "许"
    	},
    	{
    		t: "失",
    		m: "to fail/to lose//to miss"
    	},
    	{
    		t: "遊",
    		m: "to tour / to roam / to travel / to walk",
    		s: "游"
    	},
    	{
    		t: "說",
    		m: "to speak / to explain / to say | to persuade",
    		s: "说"
    	},
    	{
    		t: "發",
    		m: "to bloom // to send out / to issue // to develop // to show (one's feeling)",
    		s: "发"
    	},
    	{
    		t: "場",
    		m: "large place used for a specific purpose // scene/stage",
    		s: "场"
    	},
    	{
    		t: "緊",
    		m: "tight / tense / hard up / strict",
    		s: "紧"
    	},
    	{
    		t: "急",
    		m: "urgent/pressing/hurried // rapid"
    	},
    	{
    		t: "張",
    		m: "to open up/to spread//sheet of paper/classifier for flat objects",
    		s: "张"
    	},
    	{
    		t: "避",
    		m: "to escape / to avoid / to flee"
    	},
    	{
    		t: "身",
    		m: "body//oneself // life"
    	},
    	{
    		t: "演",
    		m: "to play / to act / to perform // to develop/to evolve"
    	},
    	{
    		t: "裁",
    		m: "to cut out / to trim / to diminish / to reduce // decision/judgement"
    	},
    	{
    		t: "威",
    		m: "dignity/prestige // power/might"
    	},
    	{
    		t: "脅",
    		m: "to threaten / to coerce",
    		s: "胁"
    	},
    	{
    		t: "非",
    		m: "to not be / not // to reproach / to blame"
    	},
    	{
    		t: "核",
    		m: "nuclear/nucleus"
    	},
    	{
    		t: "國",
    		m: "country/nation/state",
    		s: "国"
    	},
    	{
    		t: "務",
    		m: "affair/business/matter",
    		s: "务"
    	},
    	{
    		t: "委",
    		m: "committee/council//to entrust"
    	},
    	{
    		t: "頂",
    		m: "top / roof / apex / crown of the head",
    		s: "顶"
    	},
    	{
    		t: "上",
    		m: "on top / upon / above / upper // to go on top / to go up"
    	},
    	{
    		t: "言",
    		m: "words / speech //to say / to talk"
    	},
    	{
    		t: "首",
    		m: "head/chief/first//classifier for poems, songs etc"
    	},
    	{
    		t: "都",
    		m: "capital city / metropolis | all/entirely"
    	},
    	{
    		t: "注",
    		m: "to inject / to pour into / to concentrate // to register / to annotate // note/comment // to pay attention // variant of 註"
    	},
    	{
    		t: "油",
    		m: "oil/fat/grease // petroleum"
    	},
    	{
    		t: "所",
    		m: "possession // place // classifier for houses, small buildings, institutions, etc... // actually"
    	},
    	{
    		t: "席",
    		m: "seat // banquet // place in a democratic assembly / classifer for banquets, conversations, etc"
    	},
    	{
    		t: "轉",
    		m: "to turn / to change direction // a turn you take among many paths // to transfer | to revolve / to rotate / to circle about",
    		s: "转"
    	},
    	{
    		t: "運",
    		m: "to transport / to move//to conduct// to use / to apply // fortune/luck/fate",
    		s: "运"
    	},
    	{
    		t: "全",
    		m: "all/whole/entire/complete // every"
    	},
    	{
    		t: "配",
    		m: "to join / to attach / to match / to fit // to mix // to engage // to allocate"
    	},
    	{
    		t: "置",
    		m: "to install / to place / to put"
    	},
    	{
    		t: "驗",
    		m: "to examine / to test / to check",
    		s: "验"
    	},
    	{
    		t: "經",
    		m: "to endure / to pass through / to undergo / to bear // channel/nerve // abbr. for economics//longitude",
    		s: "经"
    	},
    	{
    		t: "護",
    		m: "to protect",
    		s: "护"
    	},
    	{
    		t: "保",
    		m: "to defend / to protect / to keep / to ensure"
    	},
    	{
    		t: "對",
    		m: "to face / to confront / to match // towards/at // right/correct",
    		s: "对"
    	},
    	{
    		t: "備",
    		m: "to prepare / to get ready // to possess// equipped with",
    		s: "备"
    	},
    	{
    		t: "勇",
    		m: "brave"
    	},
    	{
    		t: "士",
    		m: "bachelor // specialist worker // first class military rank"
    	},
    	{
    		t: "爭",
    		m: "to argue / to debate",
    		s: "争"
    	},
    	{
    		t: "占",
    		m: "to take possession of/to occupy/to take up|to observe/to divine"
    	},
    	{
    		t: "離",
    		m: "to leave / to part from",
    		s: "离"
    	},
    	{
    		t: "開",
    		m: "to open // to start // to unfold / to lay out / to stretch / to unroll / to bloom (flower)//to boil",
    		s: "开"
    	},
    	{
    		t: "態",
    		m: "attitude // state",
    		s: "态"
    	},
    	{
    		t: "憤",
    		m: "anger/indignant/resentment",
    		s: "愤"
    	},
    	{
    		t: "怒",
    		m: "anger/fury"
    	},
    	{
    		t: "詛",
    		m: "curse/swear",
    		s: "诅"
    	},
    	{
    		t: "咒",
    		m: "incantation / magic spell // curse / malediction"
    	},
    	{
    		t: "下",
    		m: "down/downwards/below/lower//to arrive at (a conclusion, a decision, etc...)"
    	},
    	{
    		t: "搬",
    		m: "to move / to shift"
    	},
    	{
    		t: "倒",
    		m: "to fall/to collapse/to topple // to fail // actually"
    	},
    	{
    		t: "最",
    		m: "most / the most / -est"
    	},
    	{
    		t: "高",
    		m: "high / above average // tall"
    	},
    	{
    		t: "欲",
    		m: "to wish for / to desire"
    	},
    	{
    		t: "聯",
    		m: "to ally / to unite / to join",
    		s: "联"
    	},
    	{
    		t: "合",
    		m: "to join / to fit / to match / to be equal to // together/whole"
    	},
    	{
    		t: "脫",
    		m: "to take off / to escape / to get away from",
    		s: "脱"
    	},
    	{
    		t: "退",
    		m: "to back off / to retreat / to withdraw// to decline"
    	},
    	{
    		t: "商",
    		m: "commerce/merchant/dealer // to consult"
    	},
    	{
    		t: "品",
    		m: "article/product/goods/commodity // character"
    	},
    	{
    		t: "檢",
    		m: "to check / to examine / to inspect",
    		s: "检"
    	},
    	{
    		t: "家",
    		m: "home // family / classifier for families or businesses // -ist/-er/someone that has a great knowledge of an activity"
    	},
    	{
    		t: "庭",
    		m: "main hall/front courtyard//law court"
    	},
    	{
    		t: "教",
    		m: "to teach/to tell//teaching // religion"
    	},
    	{
    		t: "師",
    		m: "teacher/master/expert//model",
    		s: "师"
    	},
    	{
    		t: "的",
    		m: "of / ~'s (possessive particle) / -ly (used to create adverb) // way | goal/aim"
    	},
    	{
    		t: "般",
    		m: "sort/kind/class/way/manner"
    	},
    	{
    		t: "行",
    		m: "to go // to walk // to perform / to do | row/series//profession/professional//relating to company | behavior/conduct"
    	},
    	{
    		t: "爲",
    		m: "to act as/to behave as/to do//variant of 為 | because of/for/to//variant of 為",
    		s: "为"
    	},
    	{
    		t: "術",
    		m: "method/technique",
    		s: "术"
    	},
    	{
    		t: "固",
    		m: "hard/strong/stiff/solid/sure"
    	},
    	{
    		t: "執",
    		m: "to execute (a plan)//to grasp",
    		s: "执"
    	},
    	{
    		t: "豎",
    		m: "to erect / vertical / to hold",
    		s: "竖"
    	},
    	{
    		t: "背",
    		m: "the back of a body or object"
    	},
    	{
    		t: "景",
    		m: "circumstance // scenery"
    	},
    	{
    		t: "影",
    		m: "shadow // reflection // movie/film//photograph/image/picture"
    	},
    	{
    		t: "響",
    		m: "echo/sound/noise",
    		s: "响"
    	},
    	{
    		t: "恢",
    		m: "to restore / to recover"
    	},
    	{
    		t: "復",
    		m: "to go and return / to get back to an initial position or state // to repeat / to double // again // complex (not simple)",
    		s: "复"
    	},
    	{
    		t: "尉",
    		m: "military officer"
    	},
    	{
    		t: "出",
    		m: "to come out / to go out//to rise/to go beyond"
    	},
    	{
    		t: "服",
    		m: "clothes / dress // to wear duty or traditional clothes / to serve // to convince // to take medicine"
    	},
    	{
    		t: "農",
    		m: "to farm // agriculture",
    		s: "农"
    	},
    	{
    		t: "營",
    		m: "to operate / to manage // camp",
    		s: "营"
    	},
    	{
    		t: "門",
    		m: "door/gate/gateway/doorway // class/category // way to do something",
    		s: "门"
    	},
    	{
    		t: "由",
    		m: "cause//because//to follow // from // to / to leave it (to sb)"
    	},
    	{
    		t: "緒",
    		m: "beginnings // clues // thread",
    		s: "绪"
    	},
    	{
    		t: "宅",
    		m: "house/residence"
    	},
    	{
    		t: "靈",
    		m: "spirit / departed soul // to come true // efficacious / effective",
    		s: "灵"
    	},
    	{
    		t: "光",
    		m: "light/ray/bright"
    	},
    	{
    		t: "線",
    		m: "thread/string/wire/line",
    		s: "线"
    	},
    	{
    		t: "榮",
    		m: "glory/honor",
    		s: "荣"
    	},
    	{
    		t: "永",
    		m: "forever/always/perpetual"
    	},
    	{
    		t: "遠",
    		m: "far/distant/remote",
    		s: "远"
    	},
    	{
    		t: "販",
    		m: "to retail / to sell / to peddle // to deal in / to buy and sell / to trade in",
    		s: "贩"
    	},
    	{
    		t: "賣",
    		m: "to sell",
    		s: "卖"
    	},
    	{
    		t: "限",
    		m: "limit/bound // to set a limit (on)"
    	},
    	{
    		t: "供",
    		m: "to provide / to supply"
    	},
    	{
    		t: "給",
    		m: "to supply/to provide|to give",
    		s: "给"
    	},
    	{
    		t: "不",
    		m: "(negative prefix) / not / no"
    	},
    	{
    		t: "足",
    		m: "foot//to be sufficient/ample"
    	},
    	{
    		t: "產",
    		m: "production // to give birth / to produce // product/resource/property/estate",
    		s: "产"
    	},
    	{
    		t: "蹉",
    		m: "to error / to slip / to miss"
    	},
    	{
    		t: "跌",
    		m: "to stumble / to fall / to drop"
    	},
    	{
    		t: "部",
    		m: "part/section/division // department/ministry"
    	},
    	{
    		t: "分",
    		m: "minute//to divide/to separate//to distribute//to distinguish (good and bad)//a point|part/component/ingredient"
    	},
    	{
    		t: "稼",
    		m: "to plant / to sow grain / (farm) crop // production / fructification"
    	},
    	{
    		t: "動",
    		m: "to move / to set in movement / to displace // to alter // to stir (emotions)",
    		s: "动"
    	},
    	{
    		t: "公",
    		m: "public/common // just/fair // male (animal)"
    	},
    	{
    		t: "業",
    		m: "job/occupation/employment/business/industry",
    		s: "业"
    	},
    	{
    		t: "中",
    		m: "center/middle//china | to hit (the mark)"
    	},
    	{
    		t: "斷",
    		m: "to break / to snap / to cut off // to give up // to judge",
    		s: "断"
    	},
    	{
    		t: "冷",
    		m: "cold"
    	},
    	{
    		t: "凍",
    		m: "to freeze / to feel very cold",
    		s: "冻"
    	},
    	{
    		t: "擊",
    		m: "to hit / to strike / to break",
    		s: "击"
    	},
    	{
    		t: "打",
    		m: "to beat / to hit / to strike / to break//to fetch//to calculate"
    	},
    	{
    		t: "工",
    		m: "work/profession/labor"
    	},
    	{
    		t: "設",
    		m: "to establish / to found //to set / to arrange",
    		s: "设"
    	},
    	{
    		t: "施",
    		m: "to carry out / to establish / to act / to implement // to grant / to give"
    	},
    	{
    		t: "實",
    		m: "real/true//really// honest // solid // compared to 진(真) which describes the truth in term of facts (for instance sincerity, verity, lies, etc...), this character describes the truth in terms of reality of the world and its presence as a material space and structure.",
    		s: "实"
    	},
    	{
    		t: "整",
    		m: "even/in order // orderly // to order // to repair"
    	},
    	{
    		t: "界",
    		m: "boundary/scope/extent // group // kingdom"
    	},
    	{
    		t: "推",
    		m: "to push (forward) // to nominate / to elect // to recommend"
    	},
    	{
    		t: "通",
    		m: "to go through // to connect / to communicate"
    	},
    	{
    		t: "路",
    		m: "road/route/line/passage // journey"
    	},
    	{
    		t: "火",
    		m: "fire/flaming/hot // anger"
    	},
    	{
    		t: "災",
    		m: "disaster/calamity",
    		s: "灾"
    	},
    	{
    		t: "縮",
    		m: "to contract / to shrink",
    		s: "缩"
    	},
    	{
    		t: "濃",
    		m: "concentrated/dense/strong",
    		s: "浓"
    	},
    	{
    		t: "左",
    		m: "left // the left (politics) // east"
    	},
    	{
    		t: "派",
    		m: "group/faction/clique/faction // to send"
    	},
    	{
    		t: "誕",
    		m: "birth/birthday",
    		s: "诞"
    	},
    	{
    		t: "葛",
    		m: "kudzu"
    	},
    	{
    		t: "藤",
    		m: "cane/vine"
    	},
    	{
    		t: "深",
    		m: "deep/profound/dark // heavy/severe"
    	},
    	{
    		t: "域",
    		m: "field/region/area/domain"
    	},
    	{
    		t: "口",
    		m: "mouth / classifier for things with mouths"
    	},
    	{
    		t: "再",
    		m: "again / once more / re- / another / second//then"
    	},
    	{
    		t: "候",
    		m: "to wait//season/climate"
    	},
    	{
    		t: "當",
    		m: "as / same / equal / as if (prediction) // should // manage/withstand // on the spot / just at (a time or place) / right (at)",
    		s: "当"
    	},
    	{
    		t: "得",
    		m: "to obtain/to get/to gain//to catch//proper/suitable|to make clear"
    	},
    	{
    		t: "獲",
    		m: "to catch / to capture / to obtain",
    		s: "获"
    	},
    	{
    		t: "票",
    		m: "ticket / ballot / bank note"
    	},
    	{
    		t: "錄",
    		m: "diary/record",
    		s: "录"
    	},
    	{
    		t: "預",
    		m: "in advance / beforehand // to advance / to prepare",
    		s: "预"
    	},
    	{
    		t: "想",
    		m: "thought//to form in mind // to think / to believe // to wish / to want // to suppose"
    	},
    	{
    		t: "式",
    		m: "type/style/form/pattern // formality // official // ceremony"
    	},
    	{
    		t: "構",
    		m: "to construct / to compose / to form / to make up",
    		s: "构"
    	},
    	{
    		t: "築",
    		m: "to build / to construct",
    		s: "筑"
    	},
    	{
    		t: "環",
    		m: "ring / loop / chain (link) / part // to surround / to encircle",
    		s: "环"
    	},
    	{
    		t: "擴",
    		m: "enlarge",
    		s: "扩"
    	},
    	{
    		t: "散",
    		m: "to scatter / to break up / to disperse / to disseminate "
    	},
    	{
    		t: "詩",
    		m: "poem/poetry/verse",
    		s: "诗"
    	},
    	{
    		t: "相",
    		m: "each other / one another / mutually | appearance/portrait/picture // government minister"
    	},
    	{
    		t: "儀",
    		m: "ceremony/rites//appearance/behavior//apparatus",
    		s: "仪"
    	},
    	{
    		t: "賞",
    		m: "a reward // (beauty) appreciation",
    		s: "赏"
    	},
    	{
    		t: "陣",
    		m: "disposition of troops//burst//spell",
    		s: "阵"
    	},
    	{
    		t: "取",
    		m: "to get / to take / to choose / to fetch"
    	},
    	{
    		t: "材",
    		m: "material//aptitude/ability/a capable individual"
    	},
    	{
    		t: "廳",
    		m: "hall // living room",
    		s: "厅"
    	},
    	{
    		t: "曙",
    		m: "daybreak/dawn"
    	},
    	{
    		t: "著",
    		m: "to write // book // to show / to prove / to make known // outstanding | to touch / to come in contact with // to fall asleep | to wear (clothes) // to use / to apply//to contact | -ing",
    		s: "着"
    	},
    	{
    		t: "表",
    		m: "to show (one's opinion, an information) / to express // a model (listing information) // exterior surface"
    	},
    	{
    		t: "內",
    		m: "inside/inner/internal/within/interior",
    		s: "内"
    	},
    	{
    		t: "訓",
    		m: "to teach / to train // pattern/example",
    		s: "训"
    	},
    	{
    		t: "滲",
    		m: "to seep / to ooze / to flow",
    		s: "渗"
    	},
    	{
    		t: "去",
    		m: "to go // (of a time, event, etc) just passed or elapsed // to remove / to get rid of"
    	},
    	{
    		t: "殺",
    		m: "to kill / to murder // to fight",
    		s: "杀"
    	},
    	{
    		t: "害",
    		m: "to do harm to // to cause trouble to // harm/evil/calamity"
    	},
    	{
    		t: "醫",
    		m: "medical / medicine / doctor / to cure / to treat",
    		s: "医"
    	},
    	{
    		t: "療",
    		m: "therapy // to treat / to cure",
    		s: "疗"
    	},
    	{
    		t: "室",
    		m: "room"
    	},
    	{
    		t: "從",
    		m: "from//to join/to engage/to obey//to follow",
    		s: "从"
    	},
    	{
    		t: "院",
    		m: "institution/courtyard"
    	},
    	{
    		t: "病",
    		m: "illness/disease"
    	},
    	{
    		t: "疑",
    		m: "to doubt / to misbelieve / to suspect"
    	},
    	{
    		t: "嫌",
    		m: "suspicion/resentment"
    	},
    	{
    		t: "逮",
    		m: "to arrest / to seize / to overtake"
    	},
    	{
    		t: "捕",
    		m: "to catch / to seize / to capture"
    	},
    	{
    		t: "新",
    		m: "new/newly"
    	},
    	{
    		t: "兒",
    		m: "son",
    		s: "儿"
    	},
    	{
    		t: "勤",
    		m: "diligent/industrious/hardworking // frequent/regular/constant"
    	},
    	{
    		t: "拘",
    		m: "to capture / to restrain / to constrain"
    	},
    	{
    		t: "禁",
    		m: "to prohibit / to forbid"
    	},
    	{
    		t: "件",
    		m: "item/component // case / matter / classifier for events"
    	},
    	{
    		t: "刻",
    		m: "to carve/to engrave//oppressive/severe // moment / classifier for short time intervals"
    	},
    	{
    		t: "父",
    		m: "father"
    	},
    	{
    		t: "母",
    		m: "mother / elderly female relative // source/origin"
    	},
    	{
    		t: "族",
    		m: "clan/race/nationality/ethnicity"
    	},
    	{
    		t: "進",
    		m: "to advance / to enter / to come (or go) into",
    		s: "进"
    	},
    	{
    		t: "落",
    		m: "to fall or drop / to lower / to decline or sink//to write down"
    	},
    	{
    		t: "獨",
    		m: "alone/independent/single/sole/only",
    		s: "独"
    	},
    	{
    		t: "善",
    		m: "good (virtuous) / well-disposed / good at sth / to improve or perfect"
    	},
    	{
    		t: "疲",
    		m: "weary"
    	},
    	{
    		t: "勞",
    		m: "to toil//labor//laborer",
    		s: "劳"
    	},
    	{
    		t: "感",
    		m: "to feel / to move // to touch / to affect // feeling/emotion"
    	},
    	{
    		t: "改",
    		m: "to change / to alter / to transform / to correct"
    	},
    	{
    		t: "革",
    		m: "leather//to reform // to remove / to expel (from office)"
    	},
    	{
    		t: "薦",
    		m: "to recommend",
    		s: "荐"
    	},
    	{
    		t: "皺",
    		m: "to wrinkle / wrinkled / to crease",
    		s: "皱"
    	},
    	{
    		t: "眉",
    		m: "eyebrow / upper margin"
    	},
    	{
    		t: "就",
    		m: "to undertake / to engage in // to take advantage of // only/just // then/ in that case / even if//subjected to"
    	},
    	{
    		t: "任",
    		m: "to assign / to appoint / to take up a post // office/responsibility // no matter (how, what etc)"
    	},
    	{
    		t: "低",
    		m: "low / beneath // to lower (one's head) / to incline // to hang down"
    	},
    	{
    		t: "值",
    		m: "value // (to be) worth"
    	},
    	{
    		t: "支",
    		m: "to support / to sustain // to erect / to raise"
    	},
    	{
    		t: "間",
    		m: "between//among//within a definite time or space/room",
    		s: "间"
    	},
    	{
    		t: "概",
    		m: "general // approximate"
    	},
    	{
    		t: "念",
    		m: "a thinking // remembrance // idea // to miss (sb)"
    	},
    	{
    		t: "證",
    		m: "certificate / proof // to prove / to demonstrate / to confirm",
    		s: "证"
    	},
    	{
    		t: "焦",
    		m: "worried/anxious//burnt"
    	},
    	{
    		t: "白",
    		m: "white/snowy/pure/bright // plain // empty/blank/clear // gratuitous / free of charge"
    	},
    	{
    		t: "堊",
    		m: "whitewash/plaster",
    		s: "垩"
    	},
    	{
    		t: "館",
    		m: "building // term for certain service establishments // embassy or consulate",
    		s: "馆"
    	},
    	{
    		t: "佐",
    		m: "aide/assistance // to assist / to accompany"
    	},
    	{
    		t: "位",
    		m: "seat//position//location/place"
    	},
    	{
    		t: "層",
    		m: "layer/stratum/floor",
    		s: "层"
    	},
    	{
    		t: "燄",
    		m: "fire/light",
    		s: "焰"
    	},
    	{
    		t: "綜",
    		m: "to sum up / to put together",
    		s: "综"
    	},
    	{
    		t: "會",
    		m: "to meet / to assemble / to gather // union/group/association // to be possible / to be able to / can // will",
    		s: "会"
    	},
    	{
    		t: "談",
    		m: "speech/talk // to speak / to talk / to converse / to chat / to discuss",
    		s: "谈"
    	},
    	{
    		t: "換",
    		m: "to exchange // to change / to substitute / to switch / to convert",
    		s: "换"
    	},
    	{
    		t: "柔",
    		m: "soft/flexible/supple"
    	},
    	{
    		t: "軟",
    		m: "soft/flexible",
    		s: "软"
    	},
    	{
    		t: "接",
    		m: "to connect / to join // to receive / to answer (the phone) / to meet or welcome sb"
    	},
    	{
    		t: "近",
    		m: "near / close to // approximately"
    	},
    	{
    		t: "及",
    		m: "to reach / up to / to attain//and/together"
    	},
    	{
    		t: "模",
    		m: "model/norm/pattern // wireframe!"
    	},
    	{
    		t: "糊",
    		m: "muddled/paste/scorched/cream"
    	},
    	{
    		t: "維",
    		m: "to preserve / to maintain // to hold together",
    		s: "维"
    	},
    	{
    		t: "署",
    		m: "office / bureau // to sign"
    	},
    	{
    		t: "北",
    		m: "north"
    	},
    	{
    		t: "頭",
    		m: "head // side/aspect // end | suffix for nouns",
    		s: "头"
    	},
    	{
    		t: "初",
    		m: "at first / (at the) beginning / first / start // junior/basic"
    	},
    	{
    		t: "府",
    		m: "seat of government / official resident / mansion / presidential palace"
    	},
    	{
    		t: "堅",
    		m: "strong/firm/solid/unyielding/resolute",
    		s: "坚"
    	},
    	{
    		t: "逆",
    		m: "contrary/opposite/backwards // to go against / to bretay / to rebel"
    	},
    	{
    		t: "可",
    		m: "can / able to // to permit / to approve"
    	},
    	{
    		t: "廢",
    		m: "to abolish / to abandon / to discard / to oust",
    		s: "废"
    	},
    	{
    		t: "棄",
    		m: "to abandon / to discard / to throw away",
    		s: "弃"
    	},
    	{
    		t: "含",
    		m: "to keep / to contain"
    	},
    	{
    		t: "蓄",
    		m: "to store up / to grow (e.g. a beard)"
    	},
    	{
    		t: "東",
    		m: "east",
    		s: "东"
    	},
    	{
    		t: "邦",
    		m: "country/nation/state"
    	},
    	{
    		t: "濟",
    		m: "to cross a river // to be of help",
    		s: "济"
    	},
    	{
    		t: "參",
    		m: "to take part in / to participate / to attend / to counsel",
    		s: "参"
    	},
    	{
    		t: "與",
    		m: "together with/and//to give",
    		s: "与"
    	},
    	{
    		t: "否",
    		m: "to negate/to deny//not"
    	},
    	{
    		t: "辯",
    		m: "to dispute / to debate / to argue / to discuss",
    		s: "辩"
    	},
    	{
    		t: "招",
    		m: "to recruit//to provoke/to incur"
    	},
    	{
    		t: "代",
    		m: "to substitute / to replace // to act on behalf of others // generation/dynasty/age/period/era"
    	},
    	{
    		t: "終",
    		m: "end/finish",
    		s: "终"
    	},
    	{
    		t: "關",
    		m: "related/concerned/involved //mountain pass//to close/to shut/to turn off",
    		s: "关"
    	},
    	{
    		t: "稅",
    		m: "taxes//duties",
    		s: "税"
    	},
    	{
    		t: "率",
    		m: "rate/frequency // percentage | frank/straightforward//to command/to lead"
    	},
    	{
    		t: "比",
    		m: "to compare / to contrast // particle used for comparison and \"-er than\"//ratio"
    	},
    	{
    		t: "效",
    		m: "effect/efficacy // to imitate"
    	},
    	{
    		t: "貿",
    		m: "commerce/trade",
    		s: "贸"
    	},
    	{
    		t: "易",
    		m: "easy//to change / to exchange"
    	},
    	{
    		t: "目",
    		m: "eye // item (in a list) / section // list / catalog / table of contents // order (taxonomy) // goal"
    	},
    	{
    		t: "確",
    		m: "solid/firm // real/true",
    		s: "确"
    	},
    	{
    		t: "學",
    		m: "to learn / to study // science // -ology",
    		s: "学"
    	},
    	{
    		t: "措",
    		m: "to manage / to handle / to arrange / to put in order"
    	},
    	{
    		t: "针",
    		m: " needle/pin/injection/stitch"
    	},
    	{
    		t: "過",
    		m: "to cross / to go over // to pass (time) // excessively / too-",
    		s: "过"
    	},
    	{
    		t: "賦",
    		m: "taxation",
    		s: "赋"
    	},
    	{
    		t: "課",
    		m: "to levy (tax) // course/class/lesson//subject",
    		s: "课"
    	},
    	{
    		t: "眾",
    		m: "many/numerous/multitude // crowd",
    		s: "众"
    	},
    	{
    		t: "字",
    		m: "letter/character // symbol"
    	},
    	{
    		t: "赤",
    		m: "red//bare/naked"
    	},
    	{
    		t: "議",
    		m: "to comment on/ to discuss / to suggest",
    		s: "议"
    	},
    	{
    		t: "好",
    		m: "good/well/proper//very/so|to be fond of//to have a tendency to"
    	},
    	{
    		t: "富",
    		m: "rich/abundant/wealthy"
    	},
    	{
    		t: "案",
    		m: "table//draft (for proposal) // conception/matter"
    	},
    	{
    		t: "認",
    		m: "to recognize / to admit // to know",
    		s: "认"
    	},
    	{
    		t: "追",
    		m: "to chase after / to seek // to recall"
    	},
    	{
    		t: "各",
    		m: "each/every"
    	},
    	{
    		t: "種",
    		m: "seed//kind/type/species|to plant/to grow/to cultivate",
    		s: "种"
    	},
    	{
    		t: "號",
    		m: "mark/sign // ordinal number // horn / bugle call",
    		s: "号"
    	},
    	{
    		t: "信",
    		m: "trust/confidence/belief //to trust/to believe// letter/mail/transmission"
    	},
    	{
    		t: "討",
    		m: "to discuss or study // to demand or ask for//to provoke",
    		s: "讨"
    	},
    	{
    		t: "水",
    		m: "water//liquid // beverage // river"
    	},
    	{
    		t: "準",
    		m: "standard//horizontal (old)//accurate/in accord//definitely//quasi-/para-",
    		s: "准"
    	},
    	{
    		t: "引",
    		m: "to pull // to draw // to stretch sth"
    	},
    	{
    		t: "減",
    		m: "to lower / to decrease / to reduce / to subtract / to diminish",
    		s: "减"
    	},
    	{
    		t: "裕",
    		m: "abundant"
    	},
    	{
    		t: "仇",
    		m: "hatred/animosity/enmity"
    	},
    	{
    		t: "輸",
    		m: "to transport / to donate//to lose",
    		s: "输"
    	},
    	{
    		t: "鐵",
    		m: "iron (metal)",
    		s: "铁"
    	},
    	{
    		t: "鋼",
    		m: "steel",
    		s: "钢"
    	},
    	{
    		t: "暫",
    		m: "temporary",
    		s: "暂"
    	},
    	{
    		t: "導",
    		m: "to transmit / to transfer / to deliver // to lead / to guide / to conduct / to direct",
    		s: "导"
    	},
    	{
    		t: "券",
    		m: "bond (esp. document split in two with each party holding one half) / contract / deed (i.e. title deeds)"
    	},
    	{
    		t: "金",
    		m: "golden / money // generic term for lustrous and ductile metal"
    	},
    	{
    		t: "屬",
    		m: "to be // to constitute // to belong to / subordinate to / affiliated with//genus (taxonomy)",
    		s: "属"
    	},
    	{
    		t: "數",
    		m: "number // figure//several",
    		s: "数"
    	},
    	{
    		t: "指",
    		m: "to point at (with finger)//to indicate/to refer to//finger"
    	},
    	{
    		t: "譯",
    		m: "to translate / to interpret",
    		s: "译"
    	},
    	{
    		t: "直",
    		m: "straightforward/frank // vertical // fair/reasonable"
    	},
    	{
    		t: "則",
    		m: "standard/norm/rule // principle",
    		s: "则"
    	},
    	{
    		t: "濯",
    		m: "to wash"
    	},
    	{
    		t: "洗",
    		m: "to wash / to bath"
    	},
    	{
    		t: "機",
    		m: "machine/engine // aircraft // opportunity // pivot/crucial point // intention",
    		s: "机"
    	},
    	{
    		t: "械",
    		m: "appliance/tool"
    	},
    	{
    		t: "被",
    		m: "to meet with//(indicates passive-voice clauses)//by"
    	},
    	{
    		t: "協",
    		m: "to cooperate / to help / to assist // to join / to harmonize",
    		s: "协"
    	},
    	{
    		t: "根",
    		m: "root / basis // radical (chemistry)"
    	},
    	{
    		t: "據",
    		m: "to be based on // according to / to act in accordance with / to depend on",
    		s: "据"
    	},
    	{
    		t: "苦",
    		m: "bitter/hardship/pain // to suffer"
    	},
    	{
    		t: "錢",
    		m: "coin/money",
    		s: "钱"
    	},
    	{
    		t: "銅",
    		m: "copper",
    		s: "铜"
    	},
    	{
    		t: "總",
    		m: "head/chief//general//always/in every case",
    		s: "总"
    	},
    	{
    		t: "理",
    		m: "to manage / to run (affair) // to put in order / to tidy up / to handle // inner essence / intrinsic order / reason / logic / truth // science"
    	},
    	{
    		t: "象",
    		m: "elephant // shape/form/appearance // to imitate"
    	},
    	{
    		t: "賴",
    		m: "to depend on / to hang on in a place",
    		s: "赖"
    	},
    	{
    		t: "騰",
    		m: "to soar//to clear",
    		s: "腾"
    	},
    	{
    		t: "次",
    		m: "next in sequence / next // second / vice- / sub- // inferior quality//classifier for enumerated events: time"
    	},
    	{
    		t: "擔",
    		m: "to carry/to shoulder // to undertake // to take responsibility",
    		s: "担"
    	},
    	{
    		t: "計",
    		m: "to plan // to calculate / to compute / to count // meter",
    		s: "计"
    	},
    	{
    		t: "劃",
    		m: "to delimit / to draw (a line) / to stroke // to assign",
    		s: "划"
    	},
    	{
    		t: "反",
    		m: "contrary / opposite / against / anti- // to rebel"
    	},
    	{
    		t: "撥",
    		m: "to push aside with the hand, foot, etc / to set aside / to poke",
    		s: "拨"
    	},
    	{
    		t: "電",
    		m: "electric/electricity/electrical",
    		s: "电"
    	},
    	{
    		t: "辭",
    		m: "to resign / to dismiss / to decline / to take a leave",
    		s: "辞"
    	},
    	{
    		t: "外",
    		m: "outside/foreign/external"
    	},
    	{
    		t: "書",
    		m: "book/letter/document // to write",
    		s: "书"
    	},
    	{
    		t: "職",
    		m: "duty/work responsibility//office",
    		s: "职"
    	},
    	{
    		t: "頓",
    		m: "to arrange / to layout",
    		s: "顿"
    	},
    	{
    		t: "判",
    		m: "to judge / to sentence // to discriminate / to discern"
    	},
    	{
    		t: "養",
    		m: "to bring up (children, oneself, ...) / to support // to raise (animals) / to keep (pets)",
    		s: "养"
    	},
    	{
    		t: "育",
    		m: "to have children / to raise or bring up / to educate"
    	},
    	{
    		t: "志",
    		m: "aspiration / ambition / the will"
    	},
    	{
    		t: "拔",
    		m: "to pull up / to pull out // to select / to pick // to surpass"
    	},
    	{
    		t: "啟",
    		m: "to open / to start / to initiate // to enlighten or awaken // to state / to inform",
    		s: "启"
    	},
    	{
    		t: "狂",
    		m: "mad/wild/violent"
    	},
    	{
    		t: "氣",
    		m: "to make angry / to annoy // to get angry // vital energy // gas/air",
    		s: "气"
    	},
    	{
    		t: "達",
    		m: "to attain/to reach//to amount to//to communicate//eminent",
    		s: "达"
    	},
    	{
    		t: "酷",
    		m: "ruthless/strong"
    	},
    	{
    		t: "毒",
    		m: "poison/poisonous // malicious/cruel/fierce"
    	},
    	{
    		t: "競",
    		m: "to compete / to contend / to struggle",
    		s: "竞"
    	},
    	{
    		t: "技",
    		m: "skill"
    	},
    	{
    		t: "客",
    		m: "customer/visitor/guest"
    	},
    	{
    		t: "滅",
    		m: "to extinguish/to put out/to go out (of a fire etc)//to exterminate/to wipe out",
    		s: "灭"
    	},
    	{
    		t: "剪",
    		m: "to wipe out or exterminate"
    	},
    	{
    		t: "寒",
    		m: "cold / poor // to tremble"
    	},
    	{
    		t: "資",
    		m: "resources // capital/money/expense // to supply / to provide",
    		s: "资"
    	},
    	{
    		t: "探",
    		m: "to explore / to search out / to scout // to visit"
    	},
    	{
    		t: "究",
    		m: "to investigate / to study carefully//after all"
    	},
    	{
    		t: "私",
    		m: "personal/private//selfish"
    	},
    	{
    		t: "活",
    		m: "to live // alive/living // work"
    	},
    	{
    		t: "秘",
    		m: "secret/secretary"
    	},
    	{
    		t: "訣",
    		m: "farewell // secret (of an art)",
    		s: "诀"
    	},
    	{
    		t: "研",
    		m: "study/research // to grind"
    	},
    	{
    		t: "析",
    		m: "to separate / to divide // to analyze"
    	},
    	{
    		t: "體",
    		m: "body // system // form/style",
    		s: "体"
    	},
    	{
    		t: "亂",
    		m: "in confusion / in disorder // upheaval // riot",
    		s: "乱"
    	},
    	{
    		t: "處",
    		m: "to deal with // to discipline // to punish | place/location/spot",
    		s: "处"
    	},
    	{
    		t: "違",
    		m: "to disobey / to violate / to go against // to separate",
    		s: "违"
    	},
    	{
    		t: "治",
    		m: "to rule / to govern / to have control over // to manage // to punish // to treat or manage (a disease, or through an activity that seeks for a beneficial result) / to wipe out (a pest)"
    	},
    	{
    		t: "犯",
    		m: "to violate / to offend / to assault / to crime // to make a mistake // criminal"
    	},
    	{
    		t: "要",
    		m: "important/vital/necessary//protecting // contour//may//will/going to//(used in comparison) must be / to want | to demand / to request"
    	},
    	{
    		t: "廷",
    		m: "palace courtyard"
    	},
    	{
    		t: "陪",
    		m: "to assist / to accompany / to keep sb company"
    	},
    	{
    		t: "審",
    		m: "to examine / to investigate//to try (in court)/trial",
    		s: "审"
    	},
    	{
    		t: "暴",
    		m: "violent/cruel//sudden"
    	},
    	{
    		t: "風",
    		m: "wind // style/air/manner // custom",
    		s: "风"
    	},
    	{
    		t: "集",
    		m: "to gather / to collect / to assemble together"
    	},
    	{
    		t: "團",
    		m: "round/ball // to gather // regiment/group/society // classifier for a lump or a soft mass:wad (of paper), ball (of wool), cloud (of smoke)",
    		s: "团"
    	},
    	{
    		t: "挑",
    		m: "to poke/to incite/to stir up // to raise / to dig up"
    	},
    	{
    		t: "聖",
    		m: "saint/sage//holy/sacred",
    		s: "圣"
    	},
    	{
    		t: "堂",
    		m: "(main) hall / large room for a specific purpose"
    	},
    	{
    		t: "描",
    		m: "depiction/description (with drawings rather than words)//to trace (a drawing)"
    	},
    	{
    		t: "寫",
    		m: "to write",
    		s: "写"
    	},
    	{
    		t: "每",
    		m: "each/every"
    	},
    	{
    		t: "日",
    		m: "day // sun"
    	},
    	{
    		t: "類",
    		m: "kind/type/class/category // similar",
    		s: "类"
    	},
    	{
    		t: "閱",
    		m: "to inspect / to review / to read // to go through / to experience",
    		s: "阅"
    	},
    	{
    		t: "惑",
    		m: "to confuse // to be puzzled"
    	},
    	{
    		t: "誘",
    		m: "to entice / to tempt",
    		s: "诱"
    	},
    	{
    		t: "看",
    		m: "to see / to look at / to watch // to read//to look after//to treat (an illness)"
    	},
    	{
    		t: "宪",
    		m: "constitution/statute"
    	},
    	{
    		t: "節",
    		m: "holiday/festival // node / joint / section / classifier for segments, e.g. lessons, train wagons, biblical verses // to abridge / to economize / to save // to moderate / to control",
    		s: "节"
    	},
    	{
    		t: "布",
    		m: "to announce/to declare/to make known//to unfold/to spread//cloth"
    	},
    	{
    		t: "慶",
    		m: "to celebrate",
    		s: "庆"
    	},
    	{
    		t: "財",
    		m: "money/wealth/riches/property/valuables",
    		s: "财"
    	},
    	{
    		t: "障",
    		m: "to block / to hinder / to obstruct"
    	},
    	{
    		t: "力",
    		m: "power/force/strength // ability"
    	},
    	{
    		t: "和",
    		m: "together with / with / union//and/with // peace/harmony"
    	},
    	{
    		t: "葬",
    		m: "to bury (the dead)"
    	},
    	{
    		t: "禮",
    		m: "rite/ceremony // courtesy/etiquette / gift",
    		s: "礼"
    	},
    	{
    		t: "隊",
    		m: "squadron/team/group",
    		s: "队"
    	},
    	{
    		t: "王",
    		m: "king of monarch // great/grand"
    	},
    	{
    		t: "讀",
    		m: "to read // to study",
    		s: "读"
    	},
    	{
    		t: "映",
    		m: "to reflect (light) / to shine / to project (an image onto a screen etc)"
    	},
    	{
    		t: "像",
    		m: "image // appearance/portrait // to ressemble / to look like"
    	},
    	{
    		t: "歸",
    		m: "to go back to / to return // to belong to",
    		s: "归"
    	},
    	{
    		t: "倫",
    		m: "human relationship / order / coherence"
    	},
    	{
    		t: "紙",
    		m: "paper / classifier for documents, letter etc",
    		s: "纸"
    	},
    	{
    		t: "揭",
    		m: "to take the lid off / to expose / to unmask"
    	},
    	{
    		t: "載",
    		m: "to load | to record in writing / to carry (i.e. a news in the newspaper)",
    		s: "载"
    	},
    	{
    		t: "例",
    		m: "example/instance/case // rule"
    	},
    	{
    		t: "拒",
    		m: "to resist / to repel // to refuse"
    	},
    	{
    		t: "絕",
    		m: "to cut short // to disappear / to vanish // extinct // absolutely",
    		s: "绝"
    	},
    	{
    		t: "年",
    		m: "year"
    	},
    	{
    		t: "俸",
    		m: "salary"
    	},
    	{
    		t: "黨",
    		m: "party/association/club/society",
    		s: "党"
    	},
    	{
    		t: "罰",
    		m: "to punish / to penalize",
    		s: "罚"
    	},
    	{
    		t: "卒",
    		m: "to finish // finally / at last // soldier/servant"
    	},
    	{
    		t: "狀",
    		m: "condition/state//-shaped//accusation/suit",
    		s: "状"
    	},
    	{
    		t: "後",
    		m: "back/behind/rear // afterwards/after/later",
    		s: "后"
    	},
    	{
    		t: "輩",
    		m: "generation/contemporaries",
    		s: "辈"
    	},
    	{
    		t: "將",
    		m: "general / commander-in-chief (military) // to command / to lead | will/shall",
    		s: "将"
    	},
    	{
    		t: "校",
    		m: "school"
    	},
    	{
    		t: "騷",
    		m: "trouble/disturbance/rumpus",
    		s: "骚"
    	},
    	{
    		t: "誤",
    		m: "mistake/error // to miss",
    		s: "误"
    	},
    	{
    		t: "解",
    		m: "to untie / to loosen// to emancipate//to open//to remove//to split//a dissection// to understand / to know"
    	},
    	{
    		t: "逃",
    		m: "to escape / to run away / to flee"
    	},
    	{
    		t: "亡",
    		m: "deceased // to die / to be gone // to flee"
    	},
    	{
    		t: "約",
    		m: "pact/treaty // to make an appointment / to invite // concise // approximately",
    		s: "约"
    	},
    	{
    		t: "束",
    		m: "to bind//to tie together/to make a bundle//to control"
    	},
    	{
    		t: "騎",
    		m: "to ride (an animal or bike) / to sit astride",
    		s: "骑"
    	},
    	{
    		t: "弱",
    		m: "weak/feeble // inferior"
    	},
    	{
    		t: "未",
    		m: "not yet / not / did not / have not/un-"
    	},
    	{
    		t: "遺",
    		m: "to lose / to leave behind / to omit // to bequeath",
    		s: "遗"
    	},
    	{
    		t: "跡",
    		m: "mark/trace/footprint/vestige // sign/indication",
    		s: "迹"
    	},
    	{
    		t: "寶",
    		m: "jewel/gem/treasure//precious",
    		s: "宝"
    	},
    	{
    		t: "掘",
    		m: "to dig"
    	},
    	{
    		t: "甲",
    		m: "armor (plating)//shell/carapace//nail"
    	},
    	{
    		t: "無",
    		m: "not to have / no / none / un- / -less",
    		s: "无"
    	},
    	{
    		t: "條",
    		m: "strip //classifier for long thin things (e.g. branch, river, roads)// clause (of law or treaty) / article // condition",
    		s: "条"
    	},
    	{
    		t: "優",
    		m: "excellent/superior",
    		s: "优"
    	},
    	{
    		t: "才",
    		m: "talent/ability//only/only then/just now"
    	},
    	{
    		t: "忌",
    		m: "to avoid or abstain from"
    	},
    	{
    		t: "單",
    		m: "single/only/sole // list // bill/form",
    		s: "单"
    	},
    	{
    		t: "語",
    		m: "dialect/language/speech",
    		s: "语"
    	},
    	{
    		t: "冒",
    		m: "brave//to emit/to give off//to send out (or up, forth, ...)"
    	},
    	{
    		t: "息",
    		m: "to rest//to cease/to stop//news//breath"
    	},
    	{
    		t: "休",
    		m: "to rest / to cease / to stop doing sth for a period of time"
    	},
    	{
    		t: "湖",
    		m: "lake"
    	},
    	{
    		t: "車",
    		m: "machine // vehicle/car",
    		s: "车"
    	},
    	{
    		t: "清",
    		m: "pure//clear/distinct//to clean up or purge / to settle or clear up"
    	},
    	{
    		t: "掃",
    		m: "to sweep / to broom",
    		s: "扫"
    	},
    	{
    		t: "海",
    		m: "ocean/sea"
    	},
    	{
    		t: "邊",
    		m: "side/edge // margin/border/boundary | noun suffix for location",
    		s: "边"
    	},
    	{
    		t: "女",
    		m: "female/woman // daughter"
    	},
    	{
    		t: "美",
    		m: "beautiful // very satisfactory / good"
    	},
    	{
    		t: "快",
    		m: "gratified/pleased/pleasant // rapid / quick / fast"
    	},
    	{
    		t: "樂",
    		m: "happy / cheerful // to laugh | music",
    		s: "乐"
    	},
    	{
    		t: "泳",
    		m: "swimming / to swim"
    	},
    	{
    		t: "膏",
    		m: "ointment/paste"
    	},
    	{
    		t: "食",
    		m: "to eat // food | to feed"
    	},
    	{
    		t: "拾",
    		m: "to pick up"
    	},
    	{
    		t: "倉",
    		m: "barn/storehouse/cabin/hold",
    		s: "仓"
    	},
    	{
    		t: "庫",
    		m: "warehouse / storehouse // (file) library",
    		s: "库"
    	},
    	{
    		t: "加",
    		m: "to add//plus"
    	},
    	{
    		t: "銘",
    		m: "to engrave // inscribed (motto)",
    		s: "铭"
    	},
    	{
    		t: "等",
    		m: "class/rank/grade//equal to/same as//et cetera/and so on//to wait for/to await"
    	},
    	{
    		t: "組",
    		m: "to form / to organize // group/team",
    		s: "组"
    	},
    	{
    		t: "索",
    		m: "to search//large rope"
    	},
    	{
    		t: "殊",
    		m: "different/unique/special"
    	},
    	{
    		t: "常",
    		m: "always/ever/often/frequently // common/general"
    	},
    	{
    		t: "困",
    		m: "to trap / to surround // hard-pressed"
    	},
    	{
    		t: "妨",
    		m: "to hinder"
    	},
    	{
    		t: "順",
    		m: "to obey / to follow",
    		s: "顺"
    	},
    	{
    		t: "邪",
    		m: "demonic/nefarious/evil"
    	},
    	{
    		t: "徒",
    		m: "disciple/apprentice/believer"
    	},
    	{
    		t: "悔",
    		m: "to regret"
    	},
    	{
    		t: "互",
    		m: "mutual"
    	},
    	{
    		t: "防",
    		m: "to protect / to defend / to guard against / to prevent"
    	},
    	{
    		t: "衛",
    		m: "to guard / to protect / to defend",
    		s: "卫"
    	},
    	{
    		t: "強",
    		m: "strong/powerful/vigorous // violent // better",
    		s: "强"
    	},
    	{
    		t: "虛",
    		m: "empty // in vain // modest/humble",
    		s: "虚"
    	},
    	{
    		t: "憊",
    		m: "exhausted",
    		s: "惫"
    	},
    	{
    		t: "負",
    		m: "to be defeated //to bear / to carry (on one's back)",
    		s: "负"
    	},
    	{
    		t: "傷",
    		m: "to injure // injury / wound",
    		s: "伤"
    	},
    	{
    		t: "唯",
    		m: "only/alone // -ism"
    	},
    	{
    		t: "存",
    		m: "to exist // to survive // to keep"
    	},
    	{
    		t: "陰",
    		m: "shady/dark/cloudy // hidden",
    		s: "阴"
    	},
    	{
    		t: "凶",
    		m: "vicious/fierce//variant of 兇"
    	},
    	{
    		t: "但",
    		m: "only/merely // yet/still"
    	},
    	{
    		t: "屍",
    		m: "corpse",
    		s: "尸"
    	},
    	{
    		t: "只",
    		m: "only/merely/just // but"
    	},
    	{
    		t: "血",
    		m: "blood"
    	},
    	{
    		t: "旺",
    		m: "prosperous/flourishing"
    	},
    	{
    		t: "盛",
    		m: "flourishing/vigorous/magnificent"
    	},
    	{
    		t: "暇",
    		m: "leisure"
    	},
    	{
    		t: "折",
    		m: "to break / to fracture / to snap // to bend / to twist / to turn // to suffer a loss // discount"
    	},
    	{
    		t: "帽",
    		m: "hat/cap"
    	},
    	{
    		t: "陳",
    		m: "to state / to narrate / to explain / to tell // to lay out / to exhibit / to display",
    		s: "陈"
    	},
    	{
    		t: "述",
    		m: "to state / to tell / to narrate / to relate"
    	},
    	{
    		t: "慘",
    		m: "inhuman // tragic/disastrous/dim/gloomy",
    		s: "惨"
    	},
    	{
    		t: "際",
    		m: "time/occasion//to meet with (circumstances)//inter-/between//border/edge/boundary",
    		s: "际"
    	},
    	{
    		t: "警",
    		m: "police // to warn / to alert"
    	},
    	{
    		t: "監",
    		m: "to supervise / to inspect // jail/prison | supervisor/inspector",
    		s: "监"
    	},
    	{
    		t: "裡",
    		m: "interior/inside/internal",
    		s: "里"
    	},
    	{
    		t: "姓",
    		m: "family name//surname"
    	},
    	{
    		t: "淡",
    		m: "weak / light in color / tasteless // indifferent"
    	},
    	{
    		t: "超",
    		m: "to overtake / to surpass / to transcend // ultra- / super- / para-"
    	},
    	{
    		t: "能",
    		m: "can / to be able to // ability // (physics) energy"
    	},
    	{
    		t: "充",
    		m: "to satisfy / to fill / to fulfill // sufficient/full"
    	},
    	{
    		t: "係",
    		m: "to connect/to relate to/to tie up/to bind",
    		s: "系"
    	},
    	{
    		t: "管",
    		m: "to take care (of) / to control / to manage // pipe/tube/woodwind"
    	},
    	{
    		t: "吸",
    		m: "to suck in // to absorb // to breathe / to inhale"
    	},
    	{
    		t: "呼",
    		m: "to call (name) // to breath out / to exhale // to cry out / to shout"
    	},
    	{
    		t: "鮮",
    		m: "fresh / bright (in color) // aquatic foods",
    		s: "鲜"
    	},
    	{
    		t: "特",
    		m: "special/unique/unusual/distinguished"
    	},
    	{
    		t: "溝",
    		m: "ditch/gutter/groove",
    		s: "沟"
    	},
    	{
    		t: "適",
    		m: "to fit // suitable / proper",
    		s: "适"
    	},
    	{
    		t: "操",
    		m: "to control / to steer / to operate // to manage"
    	},
    	{
    		t: "夫",
    		m: "manuel worker//husband"
    	},
    	{
    		t: "話",
    		m: "spoken words / speech / talk / words",
    		s: "话"
    	},
    	{
    		t: "筋",
    		m: "muscle/tendon"
    	},
    	{
    		t: "肉",
    		m: "flesh / meat // pulp (of a fruit)"
    	},
    	{
    		t: "質",
    		m: "character/nature/quality // question // hostage",
    		s: "质"
    	},
    	{
    		t: "察",
    		m: "to examine / to inquire / to inspect / to observe / to look into"
    	},
    	{
    		t: "銃",
    		m: "gun",
    		s: "铳"
    	},
    	{
    		t: "自",
    		m: "self/oneself // from"
    	},
    	{
    		t: "拳",
    		m: "fist/boxing"
    	},
    	{
    		t: "鬥",
    		m: "to fight // to struggle",
    		s: "斗"
    	},
    	{
    		t: "遂",
    		m: "to proceed // to satisfy / to succeed / to reach//finally"
    	},
    	{
    		t: "潛",
    		m: "hidden/secret/latent // to conceal // dive",
    		s: "潜"
    	},
    	{
    		t: "伏",
    		m: "to hide / to conceal oneself"
    	},
    	{
    		t: "密",
    		m: "thick/dense // close // confidential/secret"
    	},
    	{
    		t: "項",
    		m: "item/thing//classifier for items, etc...",
    		s: "项"
    	},
    	{
    		t: "道",
    		m: "direction/way/method//road/path // skill// truth//morality/reason/principle"
    	},
    	{
    		t: "具",
    		m: "to have / to possess // tool/device/utensil/instrument//equipment"
    	},
    	{
    		t: "箱",
    		m: "box/trunk/chest"
    	},
    	{
    		t: "器",
    		m: "device/tool/utensil"
    	},
    	{
    		t: "賃",
    		m: "wages for labor // to rent",
    		s: "赁"
    	},
    	{
    		t: "面",
    		m: "face//surface//side // aspect"
    	},
    	{
    		t: "覽",
    		m: "to look at / to view / to read",
    		s: "览"
    	},
    	{
    		t: "觀",
    		m: "to look at / to watch / to observe",
    		s: "观"
    	},
    	{
    		t: "裝",
    		m: "to install / to fix // to load / to pack // adornment // dress/clothing/costume // to play a role / to pretend",
    		s: "装"
    	},
    	{
    		t: "巧",
    		m: "opportunely/coincidentally // skillful"
    	},
    	{
    		t: "今",
    		m: "now/present/current"
    	},
    	{
    		t: "責",
    		m: "duty/responsibility // blame/reproach",
    		s: "责"
    	},
    	{
    		t: "奇",
    		m: "strange/odd/weird // wonderful/surprisingly"
    	},
    	{
    		t: "異",
    		m: "different/other // unusual/strange // surprising",
    		s: "异"
    	},
    	{
    		t: "塞",
    		m: "to stop / to stuff | strategic pass / tactical border position"
    	},
    	{
    		t: "扮",
    		m: "to disguise oneself as / to dress up / to play (a role)"
    	},
    	{
    		t: "閑",
    		m: "to stay idle / not busy / leisure",
    		s: "闲"
    	},
    	{
    		t: "餘",
    		m: "extra/surplus/remaining",
    		s: "余"
    	},
    	{
    		t: "罪",
    		m: "guilt/crime/fault/blame/sin"
    	},
    	{
    		t: "爆",
    		m: "to explode / to burst"
    	},
    	{
    		t: "老",
    		m: "old"
    	},
    	{
    		t: "彈",
    		m: "crossball/bullet/shot/shell/ball",
    		s: "弹"
    	},
    	{
    		t: "雜",
    		m: "mixed // miscellaneous/various // complex",
    		s: "杂"
    	},
    	{
    		t: "在",
    		m: "(to be) in/ (located) at //existence// there is"
    	},
    	{
    		t: "惡",
    		m: "evil/fierce/vicious/ugly/coarse // to harm",
    		s: "恶"
    	},
    	{
    		t: "賊",
    		m: "thief/traitor",
    		s: "贼"
    	},
    	{
    		t: "航",
    		m: "boat/ship/craft // to navigate / to sail / to fly"
    	},
    	{
    		t: "妝",
    		m: "makeup // adornment",
    		s: "妆"
    	},
    	{
    		t: "須",
    		m: "must / to have to // beard/mustache",
    		s: "须"
    	},
    	{
    		t: "髯",
    		m: "beard/whiskers"
    	},
    	{
    		t: "早",
    		m: "early/morning"
    	},
    	{
    		t: "晚",
    		m: "late/evening/night"
    	},
    	{
    		t: "獄",
    		m: "prison",
    		s: "狱"
    	},
    	{
    		t: "鹦",
    		m: "parrot"
    	},
    	{
    		t: "鵡",
    		m: "parrot",
    		s: "鹉"
    	},
    	{
    		t: "仔",
    		m: "meticulous"
    	},
    	{
    		t: "宏",
    		m: "great/magnificent/macro-"
    	},
    	{
    		t: "壯",
    		m: "strong/robust // to strengthen",
    		s: "壮"
    	},
    	{
    		t: "怯",
    		m: "timid/cowardly/rustic"
    	},
    	{
    		t: "醜",
    		m: "shameful/ugly/disgraceful",
    		s: "丑"
    	},
    	{
    		t: "卑",
    		m: "low/base/vulgar/inferior/humble"
    	},
    	{
    		t: "蔑",
    		m: "to belittle//nothing"
    	},
    	{
    		t: "講",
    		m: "to speak / to  explain // speech/lecture",
    		s: "讲"
    	},
    	{
    		t: "毆",
    		m: "to beat up / to hit sb",
    		s: "殴"
    	},
    	{
    		t: "購",
    		m: "buy/purchase",
    		s: "购"
    	},
    	{
    		t: "用",
    		m: "to use/to employ//to have to"
    	},
    	{
    		t: "章",
    		m: "chapter/section // clause // seal/badge"
    	},
    	{
    		t: "待",
    		m: "to wait // to treat / to deal with // about to / intended to"
    	},
    	{
    		t: "必",
    		m: "certainly // must/will // necessarily"
    	},
    	{
    		t: "料",
    		m: "material/stuff // grain/feed//to expect/to anticipate/to guess"
    	},
    	{
    		t: "武",
    		m: "martial/military"
    	},
    	{
    		t: "炮",
    		m: "cannon/firecracker"
    	},
    	{
    		t: "使",
    		m: "to use / to employ // to send // envoy/messenger // to make/to cause"
    	},
    	{
    		t: "浸",
    		m: "to immerse / to soak / to steep"
    	},
    	{
    		t: "透",
    		m: "to penetrate / to pass through"
    	},
    	{
    		t: "銀",
    		m: "silver // silver colored // related to money or currency",
    		s: "银"
    	},
    	{
    		t: "山",
    		m: "mountain/hill"
    	},
    	{
    		t: "敗",
    		m: "to fail / to lose // to damage",
    		s: "败"
    	},
    	{
    		t: "到",
    		m: "up to / until (a time) / to this point // completion or result of an action / to arrive"
    	},
    	{
    		t: "底",
    		m: "background/bottom/base//end (of the month, year, etc...)"
    	},
    	{
    		t: "甚",
    		m: "very/extremely // what"
    	},
    	{
    		t: "至",
    		m: "until/to// to arrive"
    	},
    	{
    		t: "鎮",
    		m: "to calm / to cool / to chill // small town",
    		s: "镇"
    	},
    	{
    		t: "靜",
    		m: "still / calm / quiet / not moving",
    		s: "静"
    	},
    	{
    		t: "受",
    		m: "to receive / to accept//pleasant"
    	},
    	{
    		t: "聞",
    		m: "news",
    		s: "闻"
    	},
    	{
    		t: "消",
    		m: "to disappear / to vanish / to eliminate"
    	},
    	{
    		t: "煽",
    		m: "to fan into a flame / to incite"
    	},
    	{
    		t: "末",
    		m: "tip / end / final stage / latter part//powder/dust"
    	},
    	{
    		t: "尾",
    		m: "tail/remnant/extremity"
    	},
    	{
    		t: "期",
    		m: "promise // a period of time / phase / stage"
    	},
    	{
    		t: "唐",
    		m: "to exaggerate//empty//in vain"
    	},
    	{
    		t: "假",
    		m: "fake/false/artificial"
    	},
    	{
    		t: "司",
    		m: "to take charge of/to manage//department"
    	},
    	{
    		t: "恨",
    		m: "to hate / to regret"
    	},
    	{
    		t: "嘆",
    		m: "to sigh / to gasp / to exclaim",
    		s: "叹"
    	},
    	{
    		t: "偽",
    		m: "fake/false/forged/bogus",
    		s: "伪"
    	},
    	{
    		t: "步",
    		m: "a step / a pace // walk/march"
    	},
    	{
    		t: "凱",
    		m: "triumphant/victorious",
    		s: "凯"
    	},
    	{
    		t: "旋",
    		m: "to revolve / to loop // a circle | to whirl"
    	},
    	{
    		t: "馬",
    		m: "horse",
    		s: "马"
    	},
    	{
    		t: "走",
    		m: "to walk // to go // to run"
    	},
    	{
    		t: "付",
    		m: "to hand over to // to pay"
    	},
    	{
    		t: "託",
    		m: "to assign (sth to sb, e.g. a task) / to entrust (sb with sth) // to trust",
    		s: "托"
    	},
    	{
    		t: "科",
    		m: "branch of study / field / branch // administrative section"
    	},
    	{
    		t: "函",
    		m: "case/envelope"
    	},
    	{
    		t: "己",
    		m: "self/oneself"
    	},
    	{
    		t: "憾",
    		m: "regret"
    	},
    	{
    		t: "或",
    		m: "maybe/perhaps/might/possibly//or"
    	},
    	{
    		t: "是",
    		m: "to be // yes"
    	},
    	{
    		t: "龐",
    		m: "huge/enormous/tremendous",
    		s: "庞"
    	},
    	{
    		t: "灰",
    		m: "ash/dust/lime // gray"
    	},
    	{
    		t: "色",
    		m: "color//look/appearance"
    	},
    	{
    		t: "恆",
    		m: "permanent/constant // usual/ordinary",
    		s: "恒"
    	},
    	{
    		t: "契",
    		m: "to carve / carved words // to agree // a contract / a deed"
    	},
    	{
    		t: "真",
    		m: "really/truly/indeed // real/true/genuine"
    	},
    	{
    		t: "勿",
    		m: "do not"
    	},
    	{
    		t: "知",
    		m: "to know / to be aware"
    	},
    	{
    		t: "驅",
    		m: "to urge on / to run quickly / to drive",
    		s: "驱"
    	},
    	{
    		t: "完",
    		m: "whole/complete/entire // to finish / to be over"
    	},
    	{
    		t: "程",
    		m: "procedure/sequence // rule/order // journey"
    	},
    	{
    		t: "若",
    		m: "to seem // like / as // if"
    	},
    	{
    		t: "局",
    		m: "office // situation"
    	},
    	{
    		t: "犧",
    		m: "sacrifice",
    		s: "牺"
    	},
    	{
    		t: "牲",
    		m: "sacrifice animal"
    	},
    	{
    		t: "元",
    		m: "basis/root//primary//unit of money"
    	},
    	{
    		t: "怪",
    		m: "odd/strange/uncanny//bewildering//evil/monster//to wonder at"
    	},
    	{
    		t: "混",
    		m: "to mix / to mingle"
    	},
    	{
    		t: "祭",
    		m: "to offer sacrifice // festive occasion"
    	},
    	{
    		t: "綠",
    		m: "green",
    		s: "绿"
    	},
    	{
    		t: "粘",
    		m: "glutinous/sticky // to adhere"
    	},
    	{
    		t: "液",
    		m: "liquid/fluid"
    	},
    	{
    		t: "欄",
    		m: "fence/railing",
    		s: "栏"
    	},
    	{
    		t: "杆",
    		m: "pole"
    	},
    	{
    		t: "純",
    		m: "pure/simple/unmixed/genuine",
    		s: "纯"
    	},
    	{
    		t: "窗",
    		m: "shutter/window"
    	},
    	{
    		t: "英",
    		m: "brave // United Kingdom / British"
    	},
    	{
    		t: "破",
    		m: "broken / damaged / worn out // to destroy / to break // to defeat"
    	},
    	{
    		t: "漢",
    		m: "man//Chinese (language)",
    		s: "汉"
    	},
    	{
    		t: "鬼",
    		m: "terrible/damnable // ghost/demon // sinister plot / crafty"
    	},
    	{
    		t: "旅",
    		m: "trip/travel"
    	},
    	{
    		t: "滿",
    		m: "satisfied/contented // fully/completely // quite",
    		s: "满"
    	},
    	{
    		t: "良",
    		m: "gentle/good // very / very much"
    	},
    	{
    		t: "靴",
    		m: "boots"
    	},
    	{
    		t: "亦",
    		m: "also"
    	},
    	{
    		t: "閉",
    		m: "to close / to stop up / to shut / to obstruct",
    		s: "闭"
    	},
    	{
    		t: "鎖",
    		m: "chain / lock // to fasten / to lock up / to lock",
    		s: "锁"
    	},
    	{
    		t: "諾",
    		m: "consent",
    		s: "诺"
    	},
    	{
    		t: "赦",
    		m: "to pardon"
    	},
    	{
    		t: "沉",
    		m: "to sink / to be submerged / to be absorb in // to keep down / to lower / to drop"
    	},
    	{
    		t: "沙",
    		m: "sand/powder // granule"
    	},
    	{
    		t: "漠",
    		m: "desert"
    	},
    	{
    		t: "痲",
    		m: "numb/leprosy"
    	},
    	{
    		t: "藥",
    		m: "medicine/drug",
    		s: "药"
    	},
    	{
    		t: "六",
    		m: "six"
    	},
    	{
    		t: "七",
    		m: "seven"
    	},
    	{
    		t: "個",
    		m: "individual // this/that // classifier for people or objects in general//size",
    		s: "个"
    	},
    	{
    		t: "月",
    		m: "moon // month"
    	},
    	{
    		t: "周",
    		m: "all/all over // circumference/circle // lap/cycle"
    	},
    	{
    		t: "桶",
    		m: "bucket / (trash) can // barrel"
    	},
    	{
    		t: "修",
    		m: "to polish (object, skill, ...)//to cultivate/to study //to repair/to renovate//to decorate / to embellish"
    	},
    	{
    		t: "繕",
    		m: "to repair / to mend",
    		s: "缮"
    	},
    	{
    		t: "洋",
    		m: "ocean // vast // the West"
    	},
    	{
    		t: "縫",
    		m: "to sew / to stitch",
    		s: "缝"
    	},
    	{
    		t: "謀",
    		m: "scheme // to plan / to seek",
    		s: "谋"
    	},
    	{
    		t: "狡",
    		m: "crafty/sly/cunning/tricky"
    	},
    	{
    		t: "猾",
    		m: "sly"
    	},
    	{
    		t: "凡",
    		m: "ordinary/commonplace"
    	},
    	{
    		t: "憶",
    		m: "to recollect / to remember / memory",
    		s: "忆"
    	},
    	{
    		t: "番",
    		m: "classifier for occurrences//kind/sort"
    	},
    	{
    		t: "習",
    		m: "to practice//to study//habit",
    		s: "习"
    	},
    	{
    		t: "歡",
    		m: "joyous/happy/pleased",
    		s: "欢"
    	},
    	{
    		t: "迎",
    		m: "to welcome/to meet/to face"
    	},
    	{
    		t: "畫",
    		m: "picture/painting",
    		s: "画"
    	},
    	{
    		t: "連",
    		m: "to link / to join / to connect // in succession // even",
    		s: "连"
    	},
    	{
    		t: "基",
    		m: "base/foundation/basic/radical"
    	},
    	{
    		t: "御",
    		m: "to resist // to manage / to govern"
    	},
    	{
    		t: "空",
    		m: "empty//air/sky // in vain"
    	},
    	{
    		t: "命",
    		m: "life/fate//order/command//to assign a name, title etc"
    	},
    	{
    		t: "令",
    		m: "to order / to command"
    	},
    	{
    		t: "編",
    		m: "to edit / to arrange / to compile",
    		s: "编"
    	},
    	{
    		t: "輯",
    		m: "to gather up/to collect//to edit / to compile",
    		s: "辑"
    	},
    	{
    		t: "樣",
    		m: "shape/appearance // pattern // manner/way",
    		s: "样"
    	},
    	{
    		t: "照",
    		m: "to illuminate//to reflect//according to/in accordance with"
    	},
    	{
    		t: "境",
    		m: "condition/circumstances // border/boundary // territory/place"
    	},
    	{
    		t: "果",
    		m: "fruit // result //indeed//if really"
    	},
    	{
    		t: "多",
    		m: "many / much / a lot of // how (to that extent)"
    	},
    	{
    		t: "澤",
    		m: "luster // favor or beneficence // damp/moist",
    		s: "泽"
    	},
    	{
    		t: "射",
    		m: "to shoot/to launch//radio- (chemistry)"
    	},
    	{
    		t: "向",
    		m: "towards // to face // to support / to side with // direction"
    	},
    	{
    		t: "媒",
    		m: "medium/intermediary/media"
    	},
    	{
    		t: "介",
    		m: "between // to introduce"
    	},
    	{
    		t: "變",
    		m: "to change / to transform / to vary",
    		s: "变"
    	},
    	{
    		t: "屈",
    		m: "bent"
    	},
    	{
    		t: "包",
    		m: "to cover / to wrap / to hold // packet/bundle // bag"
    	},
    	{
    		t: "段",
    		m: "paragraph/section/segment/stage"
    	},
    	{
    		t: "階",
    		m: "rank/step/stairs",
    		s: "阶"
    	},
    	{
    		t: "型",
    		m: "model/type"
    	},
    	{
    		t: "以",
    		m: "at//to use"
    	},
    	{
    		t: "願",
    		m: "to hope / to wish / to desire",
    		s: "愿"
    	},
    	{
    		t: "三",
    		m: "three"
    	},
    	{
    		t: "角",
    		m: "horn//angle/corner|role (theater)"
    	},
    	{
    		t: "形",
    		m: "form/shape"
    	},
    	{
    		t: "默",
    		m: "calm/quiet/still // to write from memory"
    	},
    	{
    		t: "算",
    		m: "to calculate/to compute//to figure"
    	},
    	{
    		t: "褒",
    		m: "to praise / to honor"
    	},
    	{
    		t: "戀",
    		m: "to love / to feel attached to",
    		s: "恋"
    	},
    	{
    		t: "坐",
    		m: "to sit/to take a seat// seat"
    	},
    	{
    		t: "標",
    		m: "the topmost branches of a tree / indication // sign / mark",
    		s: "标"
    	},
    	{
    		t: "結",
    		m: "to tie / to bind | firm/solid",
    		s: "结"
    	},
    	{
    		t: "造",
    		m: "to make / to build / to manufacture / to fabricate // to invent"
    	},
    	{
    		t: "回",
    		m: "to circle / to revolve // to go back / to turn around / to return// to answer"
    	},
    	{
    		t: "男",
    		m: "male"
    	},
    	{
    		t: "子",
    		m: "noun suffix|son/child // small thing"
    	},
    	{
    		t: "劣",
    		m: "inferior"
    	},
    	{
    		t: "貪",
    		m: "to have voracious desire for / greedy / to covet",
    		s: "贪"
    	},
    	{
    		t: "餓",
    		m: "to be hungry / hungry",
    		s: "饿"
    	},
    	{
    		t: "德",
    		m: "virtue/goodness/kindness // favor // morality/ethics"
    	},
    	{
    		t: "便",
    		m: "to relieve oneself//convenient//easy/simple//then/soon afterwards"
    	},
    	{
    		t: "幸",
    		m: "fortunate/lucky"
    	},
    	{
    		t: "巨",
    		m: "very large / huge / tremendous / gigantic"
    	},
    	{
    		t: "蒐",
    		m: "to gather / to collect"
    	},
    	{
    		t: "覺",
    		m: "to be aware (of)//awake//to feel/to find that|a nap/a sleep",
    		s: "觉"
    	},
    	{
    		t: "舊",
    		m: "old / opposite: new 新 // former",
    		s: "旧"
    	},
    	{
    		t: "噴",
    		m: "to puff / to spout / to spit / to spray / to spurt",
    		s: "喷"
    	},
    	{
    		t: "小",
    		m: "small/tiny // young"
    	},
    	{
    		t: "移",
    		m: "to move // to shift / to alter / to change // to remove"
    	},
    	{
    		t: "忍",
    		m: "to bear / to endure // to tolerate // to restrain oneself"
    	},
    	{
    		t: "耐",
    		m: "capable of enduring / able to tolerate // patient // durable/hardy/resistant"
    	},
    	{
    		t: "試",
    		m: "test/experiment//try // examination/test",
    		s: "试"
    	},
    	{
    		t: "弄",
    		m: "to play with / to fool with / to mess with / to toy with // to handle//to fix"
    	},
    	{
    		t: "顧",
    		m: "to look after // to take into consideration",
    		s: "顾"
    	},
    	{
    		t: "辜",
    		m: "crime // sin"
    	},
    	{
    		t: "危",
    		m: "danger"
    	},
    	{
    		t: "誠",
    		m: "honest/sincere/true",
    		s: "诚"
    	},
    	{
    		t: "泰",
    		m: "safe/peaceful"
    	},
    	{
    		t: "然",
    		m: "like this/as it is /-ly // so/thus"
    	},
    	{
    		t: "殘",
    		m: "to destroy / to spoil / to ruin // cruel/oppressive/savage/brutal // remnant // to survive",
    		s: "残"
    	},
    	{
    		t: "稱",
    		m: "to state / to name // appellation/name // to praise",
    		s: "称"
    	},
    	{
    		t: "贊",
    		m: "to support / to praise",
    		s: "赞"
    	},
    	{
    		t: "圖",
    		m: "diagram/picture/drawing // to plan / to scheme // to attempt",
    		s: "图"
    	},
    	{
    		t: "童",
    		m: "child"
    	},
    	{
    		t: "忠",
    		m: "loyal/devoted/honest"
    	},
    	{
    		t: "其",
    		m: "that/such"
    	},
    	{
    		t: "他",
    		m: "other/another // him/he"
    	},
    	{
    		t: "列",
    		m: "row/line // series/column/file // to line up / to arrange"
    	},
    	{
    		t: "耳",
    		m: "ear"
    	},
    	{
    		t: "半",
    		m: "half/semi-//incomplete"
    	},
    	{
    		t: "香",
    		m: "fragrance / scent // sweet smelling // aromatic // savory/appetizing"
    	},
    	{
    		t: "交",
    		m: "to make friends // to deliver // to hand over // exchange // crossing arrows!"
    	},
    	{
    		t: "煤",
    		m: "coal"
    	},
    	{
    		t: "煙",
    		m: "smoke // vapor // tobacco plant",
    		s: "烟"
    	},
    	{
    		t: "臺",
    		m: "desk/table/counter/stall // stage/platform/stand // station",
    		s: "台"
    	},
    	{
    		t: "飾",
    		m: "decoration/ornament // to decorate / to adorn / to ornate",
    		s: "饰"
    	},
    	{
    		t: "雙",
    		m: "pair/double/two",
    		s: "双"
    	},
    	{
    		t: "迷",
    		m: "crazy about / fan / enthusiast // lost/confused"
    	},
    	{
    		t: "齒",
    		m: "tooth",
    		s: "齿"
    	},
    	{
    		t: "徵",
    		m: "evidence / characteristic sign (used as proof) / symptom // to attack",
    		s: "征"
    	},
    	{
    		t: "印",
    		m: "print/stamp/mark/seal // to engrave / to mark / to print"
    	},
    	{
    		t: "熱",
    		m: "to warm up / to heat up // hot/fervent // heat",
    		s: "热"
    	},
    	{
    		t: "濕",
    		m: "moist/wet",
    		s: "湿"
    	},
    	{
    		t: "暖",
    		m: "warm // to heat"
    	},
    	{
    		t: "房",
    		m: "room // house"
    	},
    	{
    		t: "繼",
    		m: "to continue / to go on with // to follow after",
    		s: "继"
    	},
    	{
    		t: "貸",
    		m: "to borrow // a loan",
    		s: "贷"
    	},
    	{
    		t: "尊",
    		m: "to honor / to respect"
    	},
    	{
    		t: "世",
    		m: "world // generation/descendant // era/epoch // life/lifetime"
    	},
    	{
    		t: "星",
    		m: "star / satellite / heavenly body"
    	},
    	{
    		t: "天",
    		m: "day // sky/heaven"
    	},
    	{
    		t: "漆",
    		m: "paint/lacquer"
    	},
    	{
    		t: "努",
    		m: "to strive / to exert"
    	},
    	{
    		t: "貫",
    		m: "to pass through / to pierce through",
    		s: "贯"
    	},
    	{
    		t: "宗",
    		m: "school/sect/clan"
    	},
    	{
    		t: "軍",
    		m: "army/military/arms",
    		s: "军"
    	},
    	{
    		t: "少",
    		m: "few | young"
    	},
    	{
    		t: "驛",
    		m: "relay station /station/stop",
    		s: "驿"
    	},
    	{
    		t: "寂",
    		m: "silent // solitary"
    	},
    	{
    		t: "些",
    		m: "some/few/several"
    	},
    	{
    		t: "冊",
    		m: "book",
    		s: "册"
    	},
    	{
    		t: "輕",
    		m: "light/easy/gentle/soft // reckless",
    		s: "轻"
    	},
    	{
    		t: "致",
    		m: "to cause // to convey / to send / to deliver"
    	},
    	{
    		t: "訴",
    		m: "to complain / to tell // to sue",
    		s: "诉"
    	},
    	{
    		t: "訟",
    		m: "litigation",
    		s: "讼"
    	},
    	{
    		t: "二",
    		m: "two"
    	},
    	{
    		t: "百",
    		m: "hundred/numerous/all kinds of"
    	},
    	{
    		t: "八",
    		m: "eight"
    	},
    	{
    		t: "稚",
    		m: "infantile/young"
    	},
    	{
    		t: "拙",
    		m: "clumsy // awkward // dull"
    	},
    	{
    		t: "放",
    		m: "to put/to place//to release / to free // to let go / to let out //to set off (fireworks)"
    	},
    	{
    		t: "哀",
    		m: "sorrow/grief/pity // to lament"
    	},
    	{
    		t: "痛",
    		m: "ache/pain/sorrow // deeply/thoroughly"
    	},
    	{
    		t: "愉",
    		m: "pleased"
    	},
    	{
    		t: "穩",
    		m: "stable // steady",
    		s: "稳"
    	},
    	{
    		t: "十",
    		m: "ten"
    	},
    	{
    		t: "填",
    		m: "to fill / to stuff // to fill in (a form)"
    	},
    	{
    		t: "船",
    		m: "a boat / vessel / ship"
    	},
    	{
    		t: "骸",
    		m: "bones of the body"
    	},
    	{
    		t: "骨",
    		m: "bone"
    	},
    	{
    		t: "肯",
    		m: "to agree / to consent // willing / to be ready (to do sth)"
    	},
    	{
    		t: "功",
    		m: "achievement/result // accomplishment/work"
    	},
    	{
    		t: "槍",
    		m: "spear // gun",
    		s: "枪"
    	},
    	{
    		t: "摯",
    		m: "sincere",
    		s: "挚"
    	},
    	{
    		t: "怖",
    		m: "terrified/afraid/frightened // terror"
    	},
    	{
    		t: "悲",
    		m: "sad/sadness/sorrow/grief"
    	},
    	{
    		t: "鳴",
    		m: "to cry",
    		s: "鸣"
    	},
    	{
    		t: "櫥",
    		m: "wardrobe/cabinet/closet",
    		s: "橱"
    	},
    	{
    		t: "柜",
    		m: "cupboard/cabinet/wardrobe"
    	},
    	{
    		t: "欌",
    		m: "wardrobe/closet/cabinet"
    	},
    	{
    		t: "仗",
    		m: "weaponry // to hold (a weapon) / to wield // war/battle // to rely on / to depend on"
    	},
    	{
    		t: "籠",
    		m: "basket // cage",
    		s: "笼"
    	},
    	{
    		t: "切",
    		m: "to correspond to//close to//eager|to cut/to slice"
    	},
    	{
    		t: "簡",
    		m: "simple/uncomplicated",
    		s: "简"
    	},
    	{
    		t: "饌",
    		m: "food/delicacies",
    		s: "馔"
    	},
    	{
    		t: "飯",
    		m: "food / cuisine / cooked rice / meal",
    		s: "饭"
    	},
    	{
    		t: "腦",
    		m: "brain/mind/head // essence",
    		s: "脑"
    	},
    	{
    		t: "援",
    		m: "to help / to assist / to aid"
    	},
    	{
    		t: "闆",
    		m: "boss/adult/master",
    		s: "板"
    	},
    	{
    		t: "專",
    		m: "special / for a particular person, occasion, purpose // particular (to sth) / expert/specialized//concentrated",
    		s: "专"
    	},
    	{
    		t: "惠",
    		m: "favor/benefit // to give sb property or advantage"
    	},
    	{
    		t: "絡",
    		m: "net-like",
    		s: "络"
    	},
    	{
    		t: "婚",
    		m: "to marry / to take a wife // marriage/wedding"
    	},
    	{
    		t: "花",
    		m: "flower/blossom//to spend (money, time, etc...)"
    	},
    	{
    		t: "糖",
    		m: "sugar/sweets/candy"
    	},
    	{
    		t: "干",
    		m: "to concern / to interfere // shield (protection) // stem (plants) | to work / to do / to manage"
    	},
    	{
    		t: "燥",
    		m: "dry // impatient"
    	},
    	{
    		t: "住",
    		m: "to live/to dwell/to stay/to reside//to stop"
    	},
    	{
    		t: "藏",
    		m: "to collect // to store"
    	},
    	{
    		t: "幽",
    		m: "remote / hidden away / secluded // (in superstition indicates) the underworld // serene/peaceful"
    	},
    	{
    		t: "愛",
    		m: "to love / to be fond of / to like // affection",
    		s: "爱"
    	},
    	{
    		t: "肖",
    		m: "similar/resembling // to resemble / to look like"
    	},
    	{
    		t: "石",
    		m: "rock/stone"
    	},
    	{
    		t: "拋",
    		m: "to throw / to fling / to toss // to abandon",
    		s: "抛"
    	},
    	{
    		t: "酒",
    		m: "alcoholic beverage // liquor/spirits // wine"
    	},
    	{
    		t: "投",
    		m: "to throw/to pitch // to cast / to send // to seek refuge"
    	},
    	{
    		t: "輝",
    		m: "splendor // to shine upon",
    		s: "辉"
    	},
    	{
    		t: "煌",
    		m: "brilliant"
    	},
    	{
    		t: "燦",
    		m: "glorious // bright/brilliant/lustrous/resplendent",
    		s: "灿"
    	},
    	{
    		t: "爛",
    		m: "soft/mushy // utterly/thoroughly",
    		s: "烂"
    	},
    	{
    		t: "瓶",
    		m: "bottle/vase/jar"
    	},
    	{
    		t: "貞",
    		m: "chaste",
    		s: "贞"
    	},
    	{
    		t: "烈",
    		m: "ardent/intense/fierce // stern/upright/obedient // serious // to give one's life to a noble cause"
    	},
    	{
    		t: "乾",
    		m: "male principle"
    	},
    	{
    		t: "浪",
    		m: "wave // dissipated/unrestrained"
    	},
    	{
    		t: "痕",
    		m: "scar/traces"
    	},
    	{
    		t: "第",
    		m: "prefix indicating ordinal number, e.g. first, second, third, etc..."
    	},
    	{
    		t: "野",
    		m: "field / plain / open space // limit/boundary"
    	},
    	{
    		t: "荒",
    		m: "desolate/shortage // absurd"
    	},
    	{
    		t: "蓋",
    		m: "lid/cover // top // to cover / to conceal",
    		s: "盖"
    	},
    	{
    		t: "旗",
    		m: "banner/flag"
    	},
    	{
    		t: "劇",
    		m: "drama/play/show // severe",
    		s: "剧"
    	},
    	{
    		t: "兄",
    		m: "elder brother"
    	},
    	{
    		t: "弟",
    		m: "younger brother // junior male"
    	},
    	{
    		t: "盞",
    		m: "cup // glass",
    		s: "盏"
    	},
    	{
    		t: "嚴",
    		m: "tight (closely sealed) // stern/strict/severe",
    		s: "严"
    	},
    	{
    		t: "親",
    		m: "close/intimate//relative",
    		s: "亲"
    	},
    	{
    		t: "染",
    		m: "to be dyed"
    	},
    	{
    		t: "癌",
    		m: "cancer/carcinoma"
    	},
    	{
    		t: "嘔",
    		m: "vomit",
    		s: "呕"
    	},
    	{
    		t: "吐",
    		m: "to vomit / to throw up|to spit//to say//to put"
    	},
    	{
    		t: "泄",
    		m: "to leak out (of water or gas) / to drip / to drain // to discharge"
    	},
    	{
    		t: "瀉",
    		m: "to flood // torrent // diarrhea // laxative",
    		s: "泻"
    	},
    	{
    		t: "郁",
    		m: "dense (growth)"
    	},
    	{
    		t: "蒼",
    		m: "deep blue / deep green // dark blue / dark green",
    		s: "苍"
    	},
    	{
    		t: "送",
    		m: "to send / to deliver // to carry // to give (as a present) / to present"
    	},
    	{
    		t: "更",
    		m: "to change / to replace | more / even more / further"
    	},
    	{
    		t: "手",
    		m: "hand // person engaged in certain types of work / person skilled in certain types of work // classifier for skill"
    	},
    	{
    		t: "遇",
    		m: "to meet/to encounter//chance/opportunity"
    	},
    	{
    		t: "級",
    		m: "level/grade/rank/class // step",
    		s: "级"
    	},
    	{
    		t: "豆",
    		m: "bean/pea"
    	},
    	{
    		t: "腐",
    		m: "decay/rotten"
    	},
    	{
    		t: "紀",
    		m: "age/era/period",
    		s: "纪"
    	},
    	{
    		t: "舞",
    		m: "to dance // to wield / to brandish"
    	},
    	{
    		t: "粉",
    		m: "powder // whitewash // white // food prepared from starch / noodles or pasta made from any kind of flour"
    	},
    	{
    		t: "筆",
    		m: "pen/pencil/brush // to write / to compose // the strokes of Chinese characters",
    		s: "笔"
    	},
    	{
    		t: "椰",
    		m: "coconut palm"
    	},
    	{
    		t: "撑",
    		m: "to support / to prop up / to maintain"
    	},
    	{
    		t: "舶",
    		m: "ship / sea-going vessels"
    	},
    	{
    		t: "姊",
    		m: "older sister"
    	},
    	{
    		t: "妹",
    		m: "younger sister"
    	},
    	{
    		t: "寄",
    		m: "to send / to mail // to live (in a house) / to lodge"
    	},
    	{
    		t: "赠",
    		m: "to give as a present"
    	},
    	{
    		t: "西",
    		m: "the West"
    	},
    	{
    		t: "球",
    		m: "sphere/ball/globe // ball game / match"
    	},
    	{
    		t: "友",
    		m: "friend"
    	},
    	{
    		t: "埠",
    		m: "wharf/port/pier"
    	},
    	{
    		t: "罕",
    		m: "rare"
    	},
    	{
    		t: "巾",
    		m: "towel"
    	},
    	{
    		t: "廚",
    		m: "kitchen",
    		s: "厨"
    	},
    	{
    		t: "街",
    		m: "street"
    	},
    	{
    		t: "臣",
    		m: "to serve a ruler // minister"
    	},
    	{
    		t: "僧",
    		m: "monk"
    	},
    	{
    		t: "顏",
    		m: "face",
    		s: "颜"
    	},
    	{
    		t: "憎",
    		m: "to detest"
    	},
    	{
    		t: "慮",
    		m: "to think over//anxiety",
    		s: "虑"
    	},
    	{
    		t: "激",
    		m: "to arouse / to excite / to stimulate // to incite // sharp/fierce/violent"
    	},
    	{
    		t: "挫",
    		m: "to oppress / to repress // obstructed // to bend back"
    	},
    	{
    		t: "替",
    		m: "to substitute for / to take the place of / to replace"
    	},
    	{
    		t: "廉",
    		m: "honest/incorruptible // inexpensive // to investigate (old)"
    	},
    	{
    		t: "粹",
    		m: "pure/unmixed // essence"
    	},
    	{
    		t: "凄",
    		m: "lonely//melancholy//sad/mournful"
    	},
    	{
    		t: "緣",
    		m: "cause/reason // karma/fate",
    		s: "缘"
    	},
    	{
    		t: "拉",
    		m: "to pull / to drag / to draw // to play (a bowed instrument)"
    	},
    	{
    		t: "壞",
    		m: "to break down //spoiled/broken //bad",
    		s: "坏"
    	},
    	{
    		t: "越",
    		m: "to exceed / to surpass // to climb over//the more …"
    	},
    	{
    		t: "源",
    		m: "root/source/origin"
    	},
    	{
    		t: "涯",
    		m: "horizon/shore // border"
    	},
    	{
    		t: "偶",
    		m: "pair/mate // accidental"
    	},
    	{
    		t: "隱",
    		m: "secret/hidden/concealed",
    		s: "隐"
    	},
    	{
    		t: "統",
    		m: "to gather / to unify / to unite // whole",
    		s: "统"
    	},
    	{
    		t: "園",
    		m: "land used for growing plants // site used for public recreation",
    		s: "园"
    	},
    	{
    		t: "徊",
    		m: "to hesitate / to pace back and forth"
    	},
    	{
    		t: "徘",
    		m: "irresolute"
    	},
    	{
    		t: "粥",
    		m: "porridge"
    	},
    	{
    		t: "毛",
    		m: "hair // feather//wool"
    	},
    	{
    		t: "脂",
    		m: "fat"
    	},
    	{
    		t: "肪",
    		m: "animal fat"
    	},
    	{
    		t: "纖",
    		m: "fine/delicate",
    		s: "纤"
    	},
    	{
    		t: "勸",
    		m: "to advise // to try to persuade",
    		s: "劝"
    	},
    	{
    		t: "獎",
    		m: "encouragement//prize/award",
    		s: "奖"
    	},
    	{
    		t: "鱷",
    		m: "crocodile/alligator",
    		s: "鳄"
    	},
    	{
    		t: "魚",
    		m: "fish",
    		s: "鱼"
    	},
    	{
    		t: "評",
    		m: "to judge / to criticize",
    		s: "评"
    	},
    	{
    		t: "龍",
    		m: "dragon",
    		s: "龙"
    	},
    	{
    		t: "木",
    		m: "wood"
    	},
    	{
    		t: "藝",
    		m: "skill/art",
    		s: "艺"
    	},
    	{
    		t: "溫",
    		m: "warm/lukewarm // to warm up // temperature",
    		s: "温"
    	},
    	{
    		t: "弗",
    		m: "dollar"
    	},
    	{
    		t: "積",
    		m: "to amass / to accumulate / to store",
    		s: "积"
    	},
    	{
    		t: "戚",
    		m: "relative // parent // grief/sorrow"
    	},
    	{
    		t: "孤",
    		m: "lone // lonely"
    	},
    	{
    		t: "附",
    		m: "to add / to attach // to be close to"
    	},
    	{
    		t: "城",
    		m: "city walls / ramparts // city/town"
    	},
    	{
    		t: "旦",
    		m: "dawn (sunrise) / morning / daybreak / 새벽 // day"
    	},
    	{
    		t: "黃",
    		m: "yellow // to fall through",
    		s: "黄"
    	},
    	{
    		t: "昏",
    		m: "to faint // twilight"
    	},
    	{
    		t: "既",
    		m: "already/since"
    	},
    	{
    		t: "企",
    		m: "to plan a project"
    	},
    	{
    		t: "之",
    		m: "it / him / her"
    	},
    	{
    		t: "皇",
    		m: "emperor"
    	},
    	{
    		t: "帝",
    		m: "emperor"
    	},
    	{
    		t: "飛",
    		m: "to fly",
    		s: "飞"
    	},
    	{
    		t: "故",
    		m: "happening // to die // hence"
    	},
    	{
    		t: "窟",
    		m: "cave // hole"
    	},
    	{
    		t: "庵",
    		m: "small temple // hut"
    	},
    	{
    		t: "甘",
    		m: "sweet"
    	},
    	{
    		t: "露",
    		m: "dew/syrup/nectar // to show /to reveal/to expose // to betray"
    	},
    	{
    		t: "樹",
    		m: "tree//to cultivate//to set up",
    		s: "树"
    	},
    	{
    		t: "突",
    		m: "to protrude / to bulge // to break through // to rush out / to dash / to move forward quickly // sudden"
    	},
    	{
    		t: "輛",
    		m: "classifier for vehicles",
    		s: "辆"
    	},
    	{
    		t: "玩",
    		m: "to keep sth for entertainment//sth used for amusement//to play / to have fun"
    	},
    	{
    		t: "牽",
    		m: "to pull",
    		s: "牵"
    	},
    	{
    		t: "駐",
    		m: "to halt // to be stationed // to stay",
    		s: "驻"
    	},
    	{
    		t: "登",
    		m: "to ascend/to mount // to record / to publish / to enter (e.g. in a register)"
    	},
    	{
    		t: "古",
    		m: "ancient/old // paleo-"
    	},
    	{
    		t: "朝",
    		m: "morning // dynasty"
    	},
    	{
    		t: "韓",
    		m: "Han / Korea from the fall of the Joseon dynasty in 1897",
    		s: "韩"
    	},
    	{
    		t: "太",
    		m: "highest/greatest // very/extremely"
    	},
    	{
    		t: "沿",
    		m: "border/edge"
    	},
    	{
    		t: "宿",
    		m: "lodge for the night"
    	},
    	{
    		t: "波",
    		m: "wave / storm"
    	},
    	{
    		t: "草",
    		m: "grass // straw//manuscript/draft"
    	},
    	{
    		t: "宇",
    		m: "room//universe"
    	},
    	{
    		t: "宙",
    		m: "universe"
    	},
    	{
    		t: "墓",
    		m: "grave/tomb // mausoleum"
    	},
    	{
    		t: "碑",
    		m: "monument"
    	},
    	{
    		t: "冶",
    		m: "seductive in appearance"
    	},
    	{
    		t: "隕",
    		m: "meteor // to fall",
    		s: "陨"
    	},
    	{
    		t: "衝",
    		m: "thoroughfare // to go straight ahead / to rush / to clash",
    		s: "冲"
    	},
    	{
    		t: "昇",
    		m: "to rise to the rank of / to promote",
    		s: "升"
    	},
    	{
    		t: "博",
    		m: "ample/rich // plentiful"
    	},
    	{
    		t: "診",
    		m: "to examine / to treat (medically)",
    		s: "诊"
    	},
    	{
    		t: "尖",
    		m: "point (of needle) // sharp/pointed"
    	},
    	{
    		t: "況",
    		m: "situation",
    		s: "况"
    	},
    	{
    		t: "此",
    		m: "this/these"
    	},
    	{
    		t: "彼",
    		m: "that/those//(one) another"
    	},
    	{
    		t: "於",
    		m: "Oh! / Ah!"
    	},
    	{
    		t: "素",
    		m: "usually // always/ever // element/constituent"
    	},
    	{
    		t: "右",
    		m: "right"
    	},
    	{
    		t: "了",
    		m: "to finish / to achieve|(modal particle intensifying preceding clause) / (completed action marker)"
    	},
    	{
    		t: "雄",
    		m: "grand/imposing/powerful"
    	},
    	{
    		t: "福",
    		m: "happiness / good fortune / luck"
    	},
    	{
    		t: "社",
    		m: "society/group"
    	},
    	{
    		t: "隔",
    		m: "to separate / to partition//at an interval of"
    	},
    	{
    		t: "費",
    		m: "fee/charge // wasteful/expenses // to spend",
    		s: "费"
    	},
    	{
    		t: "求",
    		m: "to seek / to look for"
    	},
    	{
    		t: "幼",
    		m: "young"
    	},
    	{
    		t: "冥",
    		m: "dark/deep"
    	},
    	{
    		t: "妙",
    		m: "wonderful/clever"
    	},
    	{
    		t: "壽",
    		m: "age/life // long life",
    		s: "寿"
    	},
    	{
    		t: "繁",
    		m: "many / in great numbers // complicated"
    	},
    	{
    		t: "殖",
    		m: "to grow / to reproduce"
    	},
    	{
    		t: "漫",
    		m: "free/unrestrained // comics"
    	},
    	{
    		t: "蟲",
    		m: "lower form of animal life (insects, larvae, worms, ...)",
    		s: "虫"
    	},
    	{
    		t: "青",
    		m: "green/blue/azure // young people"
    	},
    	{
    		t: "史",
    		m: "history/annals"
    	},
    	{
    		t: "壁",
    		m: "wall/rampart/barrier"
    	},
    	{
    		t: "河",
    		m: "river"
    	},
    	{
    		t: "掌",
    		m: "palm of the hand // sole of the foot / paw / horseshoe"
    	},
    	{
    		t: "匣",
    		m: "box"
    	},
    	{
    		t: "暗",
    		m: "dark/obscure // hidden/secret"
    	},
    	{
    		t: "封",
    		m: "to seal"
    	},
    	{
    		t: "午",
    		m: "11 a.m.-1 p.m."
    	},
    	{
    		t: "咨",
    		m: "to consult"
    	},
    	{
    		t: "諮",
    		m: "variant of 咨",
    		s: "谘"
    	},
    	{
    		t: "健",
    		m: "healthy // to strengthen"
    	},
    	{
    		t: "康",
    		m: "healthy // peaceful // abundant"
    	},
    	{
    		t: "麵",
    		m: "flour//noodles",
    		s: "面"
    	},
    	{
    		t: "靠",
    		m: "to trust/to depend on"
    	},
    	{
    		t: "刷",
    		m: "to brush / to paint // to paste up"
    	},
    	{
    		t: "牙",
    		m: "tooth // ivory"
    	},
    	{
    		t: "雞",
    		m: "chicken/fowl",
    		s: "鸡"
    	},
    	{
    		t: "汁",
    		m: "juice"
    	},
    	{
    		t: "葡",
    		m: "grapes // grapevine"
    	},
    	{
    		t: "萄",
    		m: "grapes"
    	},
    	{
    		t: "芽",
    		m: "bud/sprout // but Korean language uses 싹 instead"
    	},
    	{
    		t: "蔗",
    		m: "sugar cane"
    	},
    	{
    		t: "針",
    		m: "needle/pin // injection/stitch",
    		s: "针"
    	},
    	{
    		t: "補",
    		m: "to repair / to patch / to mend//to fill (a vacancy)",
    		s: "补"
    	},
    	{
    		t: "牛",
    		m: "cow // bull"
    	},
    	{
    		t: "乳",
    		m: "breast // milk"
    	},
    	{
    		t: "慣",
    		m: "accustomed to / used to",
    		s: "惯"
    	},
    	{
    		t: "茶",
    		m: "tea / tea plant"
    	},
    	{
    		t: "珍",
    		m: "precious thing // treasure"
    	},
    	{
    		t: "珠",
    		m: "pearl//bead"
    	},
    	{
    		t: "戲",
    		m: "play // drama/show",
    		s: "戏"
    	},
    	{
    		t: "醒",
    		m: "to wake up / to become aware / to sober up"
    	},
    	{
    		t: "聽",
    		m: "to listen / to hear",
    		s: "听"
    	},
    	{
    		t: "戮",
    		m: "to kill"
    	},
    	{
    		t: "曲",
    		m: "tune/song | bent/crooked//yeast"
    	},
    	{
    		t: "似",
    		m: "similar // to resemble // -like"
    	},
    	{
    		t: "浴",
    		m: "bath//to bathe"
    	},
    	{
    		t: "衣",
    		m: "clothes"
    	},
    	{
    		t: "擇",
    		m: "to select / to choose / to pick out",
    		s: "择"
    	},
    	{
    		t: "鳥",
    		m: "bird",
    		s: "鸟"
    	},
    	{
    		t: "創",
    		m: "to begin / to start / to initiate // to create",
    		s: "创"
    	},
    	{
    		t: "音",
    		m: "sound/noise // note/tone // syllable"
    	},
    	{
    		t: "頒",
    		m: "to promulgate // to send out / to issue",
    		s: "颁"
    	},
    	{
    		t: "爐",
    		m: "stove/furnace",
    		s: "炉"
    	},
    	{
    		t: "塔",
    		m: "tower"
    	},
    	{
    		t: "兩",
    		m: "both",
    		s: "两"
    	},
    	{
    		t: "圓",
    		m: "circle/round/circular",
    		s: "圆"
    	},
    	{
    		t: "四",
    		m: "four"
    	},
    	{
    		t: "僚",
    		m: "colleague/bureaucrat"
    	},
    	{
    		t: "隻",
    		m: "classifier for birds and certain animals",
    		s: "只"
    	},
    	{
    		t: "們",
    		m: "plural marker for pronouns, and nouns, referring to individuals",
    		s: "们"
    	},
    	{
    		t: "髮",
    		m: "hair",
    		s: "发"
    	},
    	{
    		t: "怕",
    		m: "to be afraid / to fear / to dread"
    	},
    	{
    		t: "陷",
    		m: "pitfall/trap"
    	},
    	{
    		t: "阱",
    		m: "pitfall/trap"
    	},
    	{
    		t: "穽",
    		m: "variant of 阱",
    		s: "阱"
    	},
    	{
    		t: "獵",
    		m: "hunting",
    		s: "猎"
    	},
    	{
    		t: "已",
    		m: "already"
    	},
    	{
    		t: "聲",
    		m: "sound/voice/tone/noise",
    		s: "声"
    	},
    	{
    		t: "驚",
    		m: "to be frightened / to be scared",
    		s: "惊"
    	},
    	{
    		t: "恥",
    		m: "shame/disgrace",
    		s: "耻"
    	},
    	{
    		t: "辱",
    		m: "disgrace/dishonor/insult"
    	},
    	{
    		t: "震",
    		m: "to shake / to vibrate / to jolt / to quake"
    	},
    	{
    		t: "辣",
    		m: "hot (spicy) // pungent"
    	},
    	{
    		t: "五",
    		m: "five/5"
    	},
    	{
    		t: "臀",
    		m: "butt/buttocks"
    	},
    	{
    		t: "踊",
    		m: "to tread on//to stamp"
    	},
    	{
    		t: "幕",
    		m: "tent//curtain/screen"
    	},
    	{
    		t: "買",
    		m: "to buy / to purchase",
    		s: "买"
    	},
    	{
    		t: "賢",
    		m: "worthy or virtuous person",
    		s: "贤"
    	},
    	{
    		t: "制",
    		m: "to control / to regulate // variant of 製"
    	},
    	{
    		t: "抑",
    		m: "to restrain / to restrict / to keep down"
    	},
    	{
    		t: "恰",
    		m: "exactly/just"
    	},
    	{
    		t: "嘲",
    		m: "to ridicule / to mock"
    	},
    	{
    		t: "考",
    		m: "to check / to verify / to examine"
    	},
    	{
    		t: "彩",
    		m: "(bright) color / variety"
    	},
    	{
    		t: "壇",
    		m: "altar",
    		s: "坛"
    	},
    	{
    		t: "土",
    		m: "earth/dust/clay"
    	},
    	{
    		t: "褐",
    		m: "brown // gray or dark color"
    	},
    	{
    		t: "廊",
    		m: "corridor/veranda/porch"
    	},
    	{
    		t: "喻",
    		m: "analogy/metaphor"
    	},
    	{
    		t: "倦",
    		m: "tired"
    	},
    	{
    		t: "怠",
    		m: "idle/lazy // negligent/careless"
    	},
    	{
    		t: "華",
    		m: "abbr. for china//magnificent/splendid // flowery",
    		s: "华"
    	},
    	{
    		t: "麗",
    		m: "beautiful",
    		s: "丽"
    	},
    	{
    		t: "督",
    		m: "to supervise and direct"
    	},
    	{
    		t: "擢",
    		m: "to select / to pull out / to promote"
    	},
    	{
    		t: "餐",
    		m: "meal // to eat // classifier for meals"
    	},
    	{
    		t: "礙",
    		m: "to hinder / to obstruct / to block",
    		s: "碍"
    	},
    	{
    		t: "慾",
    		m: "variant of 欲",
    		s: "欲"
    	},
    	{
    		t: "臆",
    		m: "feelings // opinion/thoughts"
    	},
    	{
    		t: "測",
    		m: "to conjecture / to guess // to measure / to count",
    		s: "测"
    	},
    	{
    		t: "歎",
    		m: "variant of 嘆",
    		s: "叹"
    	},
    	{
    		t: "普",
    		m: "universal//general"
    	},
    	{
    		t: "遍",
    		m: "everywhere / all over"
    	},
    	{
    		t: "陽",
    		m: "sun // positive (electric.) // Yang, opposite: 陰 ☯",
    		s: "阳"
    	},
    	{
    		t: "瞬",
    		m: "to wink"
    	},
    	{
    		t: "哲",
    		m: "wise // philosophy"
    	},
    	{
    		t: "績",
    		m: "merit/accomplishment",
    		s: "绩"
    	},
    	{
    		t: "敵",
    		m: "enemy // match",
    		s: "敌"
    	},
    	{
    		t: "系",
    		m: "system//department//faculty"
    	},
    	{
    		t: "批",
    		m: "to criticize // to pass on"
    	},
    	{
    		t: "夢",
    		m: "dream",
    		s: "梦"
    	},
    	{
    		t: "鍊",
    		m: "to smelt / to refine"
    	},
    	{
    		t: "燃",
    		m: "to burn / to ignite / to light // to spark up (hopes)"
    	},
    	{
    		t: "炭",
    		m: "wood charcoal/coal/carbon"
    	},
    	{
    		t: "鐘",
    		m: "bell",
    		s: "钟"
    	},
    	{
    		t: "侮",
    		m: "to insult / to ridicule / to disgrace"
    	},
    	{
    		t: "量",
    		m: "capacity/quantity/amount//to estimate|to measure"
    	},
    	{
    		t: "乾",
    		m: "dry // clean // dried food | capable",
    		s: "干"
    	},
    	{
    		t: "幹",
    		m: "capable//tree trunk/trunk of human body",
    		s: "干"
    	},
    	{
    		t: "喪",
    		m: "to lose sth abstract but important",
    		s: "丧"
    	},
    	{
    		t: "症",
    		m: "disease/illness"
    	},
    	{
    		t: "麥",
    		m: "wheat//barley//oats",
    		s: "麦"
    	},
    	{
    		t: "抽",
    		m: "to draw out / to pull out from in between"
    	},
    	{
    		t: "除",
    		m: "to lessen / to lighten // to remove / to get rid of / to eliminate"
    	},
    	{
    		t: "堆",
    		m: "mass/pile/heap/stack // to pile up / to heap up"
    	},
    	{
    		t: "肥",
    		m: "fat/fertile // to fertilize // fertilizer/manure"
    	},
    	{
    		t: "埋",
    		m: "to bury"
    	},
    	{
    		t: "睏",
    		m: "sleepy/tired",
    		s: "困"
    	},
    	{
    		t: "週",
    		m: "week // weekly // variant of 周",
    		s: "周"
    	},
    	{
    		t: "魅",
    		m: "charm // magic // demon"
    	},
    	{
    		t: "誌",
    		m: "to record // to write a footnote",
    		s: "志"
    	},
    	{
    		t: "途",
    		m: "way/road/route"
    	},
    	{
    		t: "耗",
    		m: "to waste / to spend / to consume//news"
    	},
    	{
    		t: "該",
    		m: "should // the above-mentioned/that",
    		s: "该"
    	},
    	{
    		t: "貯",
    		m: "to store / to save / to stockpile",
    		s: "贮"
    	},
    	{
    		t: "礦",
    		m: "mine // or",
    		s: "矿"
    	},
    	{
    		t: "剖",
    		m: "to cut open / to analyze"
    	},
    	{
    		t: "敎",
    		m: "variant of 教"
    	},
    	{
    		t: "悚",
    		m: "frightened"
    	},
    	{
    		t: "流",
    		m: "to stream / to distribute / to circulate // class/grade/rate"
    	},
    	{
    		t: "承",
    		m: "to receive"
    	},
    	{
    		t: "釀",
    		m: "to ferment//to brew",
    		s: "酿"
    	},
    	{
    		t: "增",
    		m: "to increase / to expand / to add"
    	},
    	{
    		t: "眠",
    		m: "to sleep / to hibernate"
    	},
    	{
    		t: "謝",
    		m: "to thank//to apologize//to wither (of flowers, leaves, etc...) / to decline",
    		s: "谢"
    	},
    	{
    		t: "燈",
    		m: "lamp/lantern",
    		s: "灯"
    	},
    	{
    		t: "絶",
    		m: "variant of 絕"
    	},
    	{
    		t: "糧",
    		m: "provisions/food//grain",
    		s: "粮"
    	},
    	{
    		t: "皮",
    		m: "leather/skin/fur"
    	},
    	{
    		t: "膚",
    		m: "skin",
    		s: "肤"
    	},
    	{
    		t: "架",
    		m: "frame/framework/rack//to support"
    	},
    	{
    		t: "郵",
    		m: "post (office) / mail"
    	},
    	{
    		t: "遞",
    		m: "to hand over / to pass on sth",
    		s: "递"
    	},
    	{
    		t: "智",
    		m: "wisdom//knowledge"
    	},
    	{
    		t: "嫉",
    		m: "jealousy / to be jealous of"
    	},
    	{
    		t: "妒",
    		m: "jealous / to envy"
    	},
    	{
    		t: "複",
    		m: "to overlap // to repeat / to double // again // complex (not simple)",
    		s: "复"
    	},
    	{
    		t: "圍",
    		m: "to encircle / to surround // all around",
    		s: "围"
    	},
    	{
    		t: "魂",
    		m: "soul/spirit"
    	},
    	{
    		t: "慎",
    		m: "careful/cautious"
    	},
    	{
    		t: "劍",
    		m: "sword",
    		s: "剑"
    	},
    	{
    		t: "飲",
    		m: "to drink",
    		s: "饮"
    	},
    	{
    		t: "壤",
    		m: "soil/earth"
    	},
    	{
    		t: "江",
    		m: "river"
    	},
    	{
    		t: "橋",
    		m: "bridge",
    		s: "桥"
    	},
    	{
    		t: "梁",
    		m: "bridge"
    	},
    	{
    		t: "熔",
    		m: "to smelt/to fuse"
    	},
    	{
    		t: "板",
    		m: "board/plank//plate"
    	},
    	{
    		t: "卵",
    		m: "egg/ovum"
    	},
    	{
    		t: "採",
    		m: "to collect / to gather // to select / to choose // to pick / to pluck",
    		s: "采"
    	},
    	{
    		t: "蜂",
    		m: "bee/wasp"
    	},
    	{
    		t: "沒",
    		m: "(negative prefix for verbs) not//have not|to drown",
    		s: "没"
    	},
    	{
    		t: "守",
    		m: "to guard / to defend / to keep watch"
    	},
    	{
    		t: "播",
    		m: "to scatter / to spread // to broadcast"
    	},
    	{
    		t: "雰",
    		m: "misty/foggy"
    	},
    	{
    		t: "債",
    		m: "debt",
    		s: "债"
    	},
    	{
    		t: "苗",
    		m: "sprout"
    	},
    	{
    		t: "益",
    		m: "benefit/gain/profit/advantage"
    	},
    	{
    		t: "漁",
    		m: "to fish",
    		s: "渔"
    	},
    	{
    		t: "豐",
    		m: "plentiful/abundant/fertile",
    		s: "丰"
    	},
    	{
    		t: "敏",
    		m: "quick/nimble/agile/clever"
    	},
    	{
    		t: "捷",
    		m: "quick/nimble/prompt"
    	},
    	{
    		t: "禦",
    		m: "to defend / to resist",
    		s: "御"
    	},
    	{
    		t: "廣",
    		m: "wide//numerous",
    		s: "广"
    	},
    	{
    		t: "闊",
    		m: "wide/broad // rich",
    		s: "阔"
    	},
    	{
    		t: "濤",
    		m: "big wave",
    		s: "涛"
    	},
    	{
    		t: "眩",
    		m: "dazzling/brilliant/dazzled/dizzy"
    	},
    	{
    		t: "滄",
    		m: "vast",
    		s: "沧"
    	},
    	{
    		t: "領",
    		m: "to lead // to receive // neck/collar",
    		s: "领"
    	},
    	{
    		t: "距",
    		m: "distance // at a distance of / to be apart"
    	},
    	{
    		t: "頸",
    		m: "neck",
    		s: "颈"
    	},
    	{
    		t: "脈",
    		m: "arteries/veins/vein",
    		s: "脉"
    	},
    	{
    		t: "久",
    		m: "duration"
    	},
    	{
    		t: "汽",
    		m: "steam/vapor"
    	},
    	{
    		t: "把",
    		m: "to hold / to contain / to take hold of // to grasp"
    	},
    	{
    		t: "握",
    		m: "to hold / to grasp"
    	},
    	{
    		t: "抱",
    		m: "to embrace/to hug // to hold / to carry / to bear"
    	},
    	{
    		t: "微",
    		m: "tiny//miniature//micro-"
    	},
    	{
    		t: "笑",
    		m: "laugh/smile"
    	},
    	{
    		t: "九",
    		m: "nine/9"
    	},
    	{
    		t: "兇",
    		m: "terrible/fearful",
    		s: "凶"
    	},
    	{
    		t: "詐",
    		m: "to cheat / to swindle",
    		s: "诈"
    	},
    	{
    		t: "欺",
    		m: "to cheat"
    	},
    	{
    		t: "留",
    		m: "to stay // to retain / to keep / to remain"
    	},
    	{
    		t: "俠",
    		m: "heroic/brave/chivalrous",
    		s: "侠"
    	},
    	{
    		t: "氏",
    		m: "clan/family // Mr./Mrs."
    	},
    	{
    		t: "洶",
    		m: "tumultuous",
    		s: "汹"
    	},
    	{
    		t: "禪",
    		m: "Zen/meditation",
    		s: "禅"
    	},
    	{
    		t: "穴",
    		m: "hole/cavity/cave//acupuncture point"
    	},
    	{
    		t: "貨",
    		m: "goods//commodity//money",
    		s: "货"
    	},
    	{
    		t: "幣",
    		m: "money/coins/currency // silk",
    		s: "币"
    	},
    	{
    		t: "搭",
    		m: "to take (boat, train, etc...)"
    	},
    	{
    		t: "乘",
    		m: "to ride / to mount"
    	},
    	{
    		t: "川",
    		m: "river"
    	},
    	{
    		t: "殆",
    		m: "dangerous/perilous"
    	},
    	{
    		t: "霧",
    		m: "fog/mist",
    		s: "雾"
    	},
    	{
    		t: "戒",
    		m: "to guard against // (finger) ring"
    	},
    	{
    		t: "遲",
    		m: "slow/delayed/late",
    		s: "迟"
    	},
    	{
    		t: "滯",
    		m: "sluggish",
    		s: "滞"
    	},
    	{
    		t: "恩",
    		m: "favor/grace/kindness"
    	},
    	{
    		t: "掛",
    		m: "to be worried or concerned",
    		s: "挂"
    	},
    	{
    		t: "扶",
    		m: "to support with the hand"
    	},
    	{
    		t: "恕",
    		m: "to forgive"
    	},
    	{
    		t: "阿",
    		m: "flatter"
    	},
    	{
    		t: "敢",
    		m: "dare // to dare"
    	},
    	{
    		t: "蘇",
    		m: "to revive",
    		s: "苏"
    	},
    	{
    		t: "貌",
    		m: "appearance"
    	},
    	{
    		t: "授",
    		m: "to give // to teach / to instruct",
    		s: "授"
    	},
    	{
    		t: "頻",
    		m: "frequency/frequently/repetitious",
    		s: "频"
    	},
    	{
    		t: "徹",
    		m: "to pass through//penetrating//thorough",
    		s: "彻"
    	},
    	{
    		t: "膺",
    		m: "breast//receive"
    	},
    	{
    		t: "懲",
    		m: "to punish / to reprimand",
    		s: "惩"
    	},
    	{
    		t: "蕩",
    		m: "to wash/to sweep away/to squander//to move",
    		s: "荡"
    	},
    	{
    		t: "屋",
    		m: "house/room"
    	},
    	{
    		t: "莫",
    		m: "do not"
    	},
    	{
    		t: "征",
    		m: "journey/trip/expedition"
    	},
    	{
    		t: "篇",
    		m: "sheet / piece of writing // classifier for written items: chapter, articles, etc..."
    	},
    	{
    		t: "思",
    		m: "to think / to consider"
    	},
    	{
    		t: "摸",
    		m: "to feel with the hand / to touch // to grope // to stroke"
    	},
    	{
    		t: "勢",
    		m: "situation/conditions // power",
    		s: "势"
    	},
    	{
    		t: "盟",
    		m: "vow/oath/pledge/swear // union"
    	},
    	{
    		t: "裳",
    		m: "lower garment / skirts"
    	},
    	{
    		t: "千",
    		m: "thousand"
    	},
    	{
    		t: "疏",
    		m: "to communicate // to neglect"
    	},
    	{
    		t: "忽",
    		m: "suddenly // to neglect / to overlook/to ignore"
    	},
    	{
    		t: "恭",
    		m: "respectful"
    	},
    	{
    		t: "遜",
    		m: "humble /modest / unpretentious",
    		s: "逊"
    	},
    	{
    		t: "禍",
    		m: "disaster/calamity/catastrophe // misfortune",
    		s: "祸"
    	},
    	{
    		t: "奪",
    		m: "to seize / to take away forcibly",
    		s: "夺"
    	},
    	{
    		t: "還",
    		m: "to pay back//to return|yet/still//even more",
    		s: "还"
    	},
    	{
    		t: "諜",
    		m: "to spy",
    		s: "谍"
    	},
    	{
    		t: "損",
    		m: "to decrease // to damage / to harm",
    		s: "损"
    	},
    	{
    		t: "毀",
    		m: "to damage//to ruin / to destroy // to defame",
    		s: "毁"
    	},
    	{
    		t: "拗",
    		m: "stubborn/obstinate"
    	},
    	{
    		t: "迅",
    		m: "rapid/fast"
    	},
    	{
    		t: "紛",
    		m: "confused//disorderly//numerous",
    		s: "纷"
    	},
    	{
    		t: "颱",
    		m: "typhoon",
    		s: "台"
    	},
    	{
    		t: "雨",
    		m: "rain"
    	},
    	{
    		t: "略",
    		m: "plan/strategy//outline/summary//to summarize"
    	},
    	{
    		t: "側",
    		m: "side/lateral",
    		s: "侧"
    	},
    	{
    		t: "黑",
    		m: "black"
    	},
    	{
    		t: "躁",
    		m: "hot-tempered/impatient"
    	},
    	{
    		t: "迴",
    		m: "to curve // to return//to revolve",
    		s: "回"
    	},
    	{
    		t: "迂",
    		m: "circuitous/roundabout"
    	},
    	{
    		t: "郭",
    		m: "outer city wall"
    	},
    	{
    		t: "蹤",
    		m: "footprint/trace/tracks",
    		s: "踪"
    	},
    	{
    		t: "鑑",
    		m: "mirror//to view",
    		s: "鉴"
    	},
    	{
    		t: "潰",
    		m: "to break down",
    		s: "溃"
    	},
    	{
    		t: "愚",
    		m: "stupid // to cheat / to deceive"
    	},
    	{
    		t: "尋",
    		m: "to search for",
    		s: "寻"
    	},
    	{
    		t: "謠",
    		m: "popular ballad",
    		s: "谣"
    	},
    	{
    		t: "居",
    		m: "residence/house // to reside"
    	},
    	{
    		t: "怨",
    		m: "to complain // to blame // to mourn"
    	},
    	{
    		t: "肝",
    		m: "liver"
    	},
    	{
    		t: "瞥",
    		m: "glance"
    	},
    	{
    		t: "錯",
    		m: "dislocation//mistake/wrong/bad",
    		s: "错"
    	},
    	{
    		t: "薄",
    		m: "meager/slight/weak"
    	},
    	{
    		t: "酬",
    		m: "to repay / to reward / to return"
    	},
    	{
    		t: "襲",
    		m: "to attack",
    		s: "袭"
    	},
    	{
    		t: "絲",
    		m: "silk//thread//trace",
    		s: "丝"
    	},
    	{
    		t: "納",
    		m: "to receive / to accept",
    		s: "纳"
    	},
    	{
    		t: "依",
    		m: "to depend on//according to"
    	},
    	{
    		t: "春",
    		m: "spring (time) //youthful//love//joyful/gay"
    	},
    	{
    		t: "奉",
    		m: "to present respectfully // to accept orders (from superior)"
    	},
    	{
    		t: "仕",
    		m: "to serve as an official"
    	},
    	{
    		t: "昨",
    		m: "yesterday"
    	},
    	{
    		t: "蕭",
    		m: "desolate/miserable/dreary",
    		s: "萧"
    	},
    	{
    		t: "涼",
    		m: "cool/cold",
    		s: "凉"
    	},
    	{
    		t: "渦",
    		m: "whirlpool",
    		s: "涡"
    	},
    	{
    		t: "洞",
    		m: "cave/hole"
    	},
    	{
    		t: "秀",
    		m: "handsome/refined/elegant"
    	},
    	{
    		t: "港",
    		m: "port/harbor"
    	},
    	{
    		t: "徙",
    		m: "to change one's residence"
    	},
    	{
    		t: "祝",
    		m: "to wish / to express good wishes / to pray"
    	},
    	{
    		t: "貰",
    		m: "to rent out / to borrow",
    		s: "贳"
    	},
    	{
    		t: "豫",
    		m: "variant of 預"
    	},
    	{
    		t: "座",
    		m: "seat//base/stand//classifier for buildings, mountains, and similar immovable objects"
    	},
    	{
    		t: "範",
    		m: "pattern/model//example",
    		s: "范"
    	},
    	{
    		t: "烙",
    		m: "to brand / to iron // to bake (in a pan)"
    	},
    	{
    		t: "繫",
    		m: "to connect/to tie",
    		s: "系"
    	},
    	{
    		t: "葉",
    		m: "page//leaf",
    		s: "叶"
    	},
    	{
    		t: "琴",
    		m: "musical instrument in general"
    	},
    	{
    		t: "絃",
    		m: "string (of musical instrument)"
    	},
    	{
    		t: "丹",
    		m: "red/pellet/powder/cinnabar"
    	},
    	{
    		t: "凝",
    		m: "to congeal//to concentrate attention/to stare"
    	},
    	{
    		t: "擬",
    		m: "to imitate",
    		s: "拟"
    	},
    	{
    		t: "幻",
    		m: "fantasy"
    	},
    	{
    		t: "泉",
    		m: "spring (small stream) / water coming from earth"
    	},
    	{
    		t: "繃",
    		m: "to tie / to bind",
    		s: "绷"
    	},
    	{
    		t: "帶",
    		m: "band//ribbon//strip//zone/area/region",
    		s: "带"
    	},
    	{
    		t: "徽",
    		m: "badge/emblem//logo"
    	},
    	{
    		t: "短",
    		m: "short/brief"
    	},
    	{
    		t: "償",
    		m: "to repay / to compensate // to recompense",
    		s: "偿"
    	},
    	{
    		t: "鄰",
    		m: "neighbor/adjacent//close to",
    		s: "邻"
    	},
    	{
    		t: "紹",
    		m: "to join // to continue / to carry on",
    		s: "绍"
    	},
    	{
    		t: "膽",
    		m: "courage/guts//gall",
    		s: "胆"
    	},
    	{
    		t: "眼",
    		m: "eye"
    	},
    	{
    		t: "磁",
    		m: "magnetic / magnetism"
    	},
    	{
    		t: "村",
    		m: "village"
    	},
    	{
    		t: "栽",
    		m: "to grow // to plant"
    	},
    	{
    		t: "培",
    		m: "to cultivate (lit. or fig.) // to train (people)"
    	},
    	{
    		t: "慧",
    		m: "intelligent"
    	},
    	{
    		t: "冰",
    		m: "ice"
    	},
    	{
    		t: "陸",
    		m: "shore/land/continent",
    		s: "陆"
    	},
    	{
    		t: "枝",
    		m: "branch // classifier for sticks, rods, pencils, etc..."
    	},
    	{
    		t: "駭",
    		m: "to astonish",
    		s: "骇"
    	},
    	{
    		t: "碇",
    		m: "anchor"
    	},
    	{
    		t: "泊",
    		m: "to anchor"
    	},
    	{
    		t: "奧",
    		m: "obscure/mysterious",
    		s: "奥"
    	},
    	{
    		t: "召",
    		m: "to summon // to call together"
    	},
    	{
    		t: "喚",
    		m: "to call",
    		s: "唤"
    	},
    	{
    		t: "岩",
    		m: "rock // cliff"
    	},
    	{
    		t: "嗅",
    		m: "to smell"
    	},
    	{
    		t: "銳",
    		m: "acute",
    		s: "锐"
    	},
    	{
    		t: "臭",
    		m: "smelly // to smell (bad) // terrible"
    	},
    	{
    		t: "污",
    		m: "dirty / filthy // foul/corrupt"
    	},
    	{
    		t: "刑",
    		m: "punishment//penalty//sentence//torture"
    	},
    	{
    		t: "敬",
    		m: "to respect/to venerate//to salute"
    	},
    	{
    		t: "迫",
    		m: "to force / to compel // urgent/pressing"
    	},
    	{
    		t: "隸",
    		m: "slave//scribe",
    		s: "隶"
    	},
    	{
    		t: "寡",
    		m: "few/scant"
    	},
    	{
    		t: "萬",
    		m: "ten thousand",
    		s: "万"
    	},
    	{
    		t: "緻",
    		m: "fine/delicate",
    		s: "致"
    	},
    	{
    		t: "排",
    		m: "to eliminate/to drain//a line/a row//to line up"
    	},
    	{
    		t: "傾",
    		m: "to lean / to tend / to incline",
    		s: "倾"
    	},
    	{
    		t: "淵",
    		m: "deep pool/deep/profound",
    		s: "渊"
    	},
    	{
    		t: "捉",
    		m: "to capture/to grasp/to clutch"
    	},
    	{
    		t: "融",
    		m: "to melt//to merge/to blend"
    	},
    	{
    		t: "陋",
    		m: "low/vulgar/ugly"
    	},
    	{
    		t: "潔",
    		m: "clean",
    		s: "洁"
    	},
    	{
    		t: "奮",
    		m: "exert oneself",
    		s: "奋"
    	},
    	{
    		t: "均",
    		m: "equal/uniform/even"
    	},
    	{
    		t: "衡",
    		m: "balance//weight"
    	},
    	{
    		t: "豹",
    		m: "leopard/panther"
    	},
    	{
    		t: "裂",
    		m: "to split / to crack / to break open"
    	},
    	{
    		t: "沮",
    		m: "to destroy / to stop"
    	},
    	{
    		t: "片",
    		m: "fragment / thin piece / a slice"
    	},
    	{
    		t: "懇",
    		m: "earnest",
    		s: "恳"
    	},
    	{
    		t: "鼻",
    		m: "nose"
    	},
    	{
    		t: "奔",
    		m: "to hurry // to rush / to run quickly"
    	},
    	{
    		t: "添",
    		m: "to add / to increase / to replenish"
    	},
    	{
    		t: "斟",
    		m: "to deliberate"
    	},
    	{
    		t: "酌",
    		m: "to deliberate / to consider"
    	},
    	{
    		t: "籍",
    		m: "book or record//registry/roll"
    	},
    	{
    		t: "聰",
    		m: "quick at hearing // wise/clever/sharp-witted/intelligent",
    		s: "聪"
    	},
    	{
    		t: "悖",
    		m: "to go against/to be contrary to // rebellious"
    	},
    	{
    		t: "殲",
    		m: "to annihilate",
    		s: "歼"
    	},
    	{
    		t: "愎",
    		m: "perverse/obstinate"
    	},
    	{
    		t: "乖",
    		m: "perverse//abnormal"
    	},
    	{
    		t: "綱",
    		m: "outline",
    		s: "纲"
    	},
    	{
    		t: "扱",
    		m: "to collect / to receive"
    	},
    	{
    		t: "額",
    		m: "specified number or amount",
    		s: "额"
    	},
    	{
    		t: "舍",
    		m: "residence"
    	},
    	{
    		t: "募",
    		m: "to recruit // to collect // to raise"
    	},
    	{
    		t: "季",
    		m: "season"
    	},
    	{
    		t: "桃",
    		m: "peach"
    	},
    	{
    		t: "偵",
    		m: "to scout / to spy / to detect",
    		s: "侦"
    	},
    	{
    		t: "沌",
    		m: "confused"
    	},
    	{
    		t: "渾",
    		m: "to mix",
    		s: "浑"
    	},
    	{
    		t: "碩",
    		m: "large/big",
    		s: "硕"
    	},
    	{
    		t: "較",
    		m: "to compare / to contrast",
    		s: "较"
    	},
    	{
    		t: "劑",
    		m: "dose",
    		s: "剂"
    	},
    	{
    		t: "卓",
    		m: "outstanding"
    	},
    	{
    		t: "區",
    		m: "area/region/district//to distinguish",
    		s: "区"
    	},
    	{
    		t: "我",
    		m: "I/me//my"
    	},
    	{
    		t: "魄",
    		m: "soul"
    	},
    	{
    		t: "楚",
    		m: "suffering/pain//clear/distinct"
    	},
    	{
    		t: "站",
    		m: "station / to stand // (web)site"
    	},
    	{
    		t: "弓",
    		m: "bow (weapon)"
    	},
    	{
    		t: "癒",
    		m: "to heal",
    		s: "愈"
    	},
    	{
    		t: "拂",
    		m: "to brush away"
    	},
    	{
    		t: "侶",
    		m: "companion",
    		s: "侣"
    	},
    	{
    		t: "懼",
    		m: "to fear",
    		s: "惧"
    	},
    	{
    		t: "珊",
    		m: "coral"
    	},
    	{
    		t: "瑚",
    		m: "coral"
    	},
    	{
    		t: "奸",
    		m: "wicked/crafty//traitor"
    	},
    	{
    		t: "猛",
    		m: "ferocious/fierce/violent//abrupt//suddenly"
    	},
    	{
    		t: "逸",
    		m: "outstanding"
    	},
    	{
    		t: "晶",
    		m: "crystal"
    	},
    	{
    		t: "冠",
    		m: "crown//hat/cap"
    	},
    	{
    		t: "池",
    		m: "reservoir//pond"
    	},
    	{
    		t: "衷",
    		m: "inner feelings"
    	},
    	{
    		t: "巡",
    		m: "to patrol"
    	},
    	{
    		t: "盜",
    		m: "to steal / to rob / to plunder // thief /bandit/robber",
    		s: "盗"
    	},
    	{
    		t: "虎",
    		m: "tiger"
    	},
    	{
    		t: "狼",
    		m: "wolf"
    	},
    	{
    		t: "冬",
    		m: "winter"
    	},
    	{
    		t: "彙",
    		m: "class/collection",
    		s: "汇"
    	},
    	{
    		t: "跳",
    		m: "to jump / to hop"
    	},
    	{
    		t: "躍",
    		m: "to jump/to leap",
    		s: "跃"
    	},
    	{
    		t: "燭",
    		m: "candle",
    		s: "烛"
    	},
    	{
    		t: "俗",
    		m: "custom/convention//common//vulgar/secular"
    	},
    	{
    		t: "這",
    		m: "this//these",
    		s: "这"
    	},
    	{
    		t: "需",
    		m: "to demand / to need / to require // to want // need/necessity"
    	},
    	{
    		t: "姿",
    		m: "looks/appearance"
    	},
    	{
    		t: "詞",
    		m: "word//statement//speech//lyrics",
    		s: "词"
    	},
    	{
    		t: "飮",
    		m: "variant of 飲"
    	},
    	{
    		t: "妄",
    		m: "absurd//fantastic"
    	},
    	{
    		t: "畵",
    		m: "variant of 畫"
    	},
    	{
    		t: "暢",
    		m: "free // free from worry",
    		s: "畅"
    	},
    	{
    		t: "癡",
    		m: "variant of 痴",
    		s: "痴"
    	},
    	{
    		t: "痴",
    		m: "imbecile/stupid/foolish/silly//sentimental"
    	},
    	{
    		t: "床",
    		m: "bed/classifier for beds//couch"
    	},
    	{
    		t: "慈",
    		m: "compassionate/gentle/merciful/kind/humane"
    	},
    	{
    		t: "筒",
    		m: "tube/cylinder"
    	},
    	{
    		t: "艙",
    		m: "cabin (ship, airplane, ...)",
    		s: "舱"
    	},
    	{
    		t: "刀",
    		m: "knife/blade"
    	},
    	{
    		t: "鐮",
    		m: "scythe/sickle",
    		s: "镰"
    	},
    	{
    		t: "腳",
    		m: "foot//leg (animal or object)/base of an object",
    		s: "脚"
    	},
    	{
    		t: "盔",
    		m: "silvered rice bowl // helmet"
    	},
    	{
    		t: "鏡",
    		m: "mirror//lens",
    		s: "镜"
    	},
    	{
    		t: "腰",
    		m: "waist / lower back // loins"
    	},
    	{
    		t: "巢",
    		m: "nest"
    	},
    	{
    		t: "彎",
    		m: "to bend// bent // a bend",
    		s: "弯"
    	},
    	{
    		t: "羽",
    		m: "feather"
    	},
    	{
    		t: "鴕",
    		m: "ostrich",
    		s: "鸵"
    	},
    	{
    		t: "蛋",
    		m: "egg"
    	},
    	{
    		t: "脆",
    		m: "crispy/crunchy // fragile"
    	},
    	{
    		t: "餅",
    		m: "round flat cake / cookie / cake // pastry",
    		s: "饼"
    	},
    	{
    		t: "餌",
    		m: "lure/bait",
    		s: "饵"
    	},
    	{
    		t: "蠟",
    		m: "candle/wax",
    		s: "蜡"
    	},
    	{
    		t: "樓",
    		m: "storied building / house with more than 1 story",
    		s: "楼"
    	},
    	{
    		t: "梯",
    		m: "ladder//stairs"
    	},
    	{
    		t: "苔",
    		m: "moss"
    	},
    	{
    		t: "蘚",
    		m: "moss/lichen",
    		s: "藓"
    	},
    	{
    		t: "墨",
    		m: "ink stick"
    	},
    	{
    		t: "儲",
    		m: "to store/to save/to have in reserve//heir",
    		s: "储"
    	},
    	{
    		t: "磨",
    		m: "to grind / to rub / to polish / to sharpen"
    	},
    	{
    		t: "鏈",
    		m: "chain /cable",
    		s: "链"
    	},
    	{
    		t: "鼠",
    		m: "rat/mouse"
    	},
    	{
    		t: "玻",
    		m: "glass"
    	},
    	{
    		t: "鴨",
    		m: "duck",
    		s: "鸭"
    	},
    	{
    		t: "滑",
    		m: "to slip / to slide"
    	},
    	{
    		t: "雪",
    		m: "snow"
    	},
    	{
    		t: "刮",
    		m: "to scrape"
    	},
    	{
    		t: "槳",
    		m: "paddle/oar",
    		s: "桨"
    	},
    	{
    		t: "蹼",
    		m: "web (of ducks', frogs', etc feet)"
    	},
    	{
    		t: "猴",
    		m: "monkey"
    	},
    	{
    		t: "拼",
    		m: "to piece together"
    	},
    	{
    		t: "塊",
    		m: "lump (of earth) // chunk/ piece // classifier for pieces of cloth, cake, soap, etc...",
    		s: "块"
    	},
    	{
    		t: "盤",
    		m: "plate/dish/board//hard drive (computing)",
    		s: "盘"
    	},
    	{
    		t: "貝",
    		m: "clam/shellfish/cowrie",
    		s: "贝"
    	},
    	{
    		t: "殼",
    		m: "shell",
    		s: "壳"
    	},
    	{
    		t: "鯊",
    		m: "shark",
    		s: "鲨"
    	},
    	{
    		t: "哨",
    		m: "a whistle // sentry"
    	},
    	{
    		t: "鬍",
    		m: "beard/mustache/whiskers",
    		s: "胡"
    	},
    	{
    		t: "鞋",
    		m: "shoe"
    	},
    	{
    		t: "柬",
    		m: "card/note/letter"
    	},
    	{
    		t: "叉",
    		m: "fork//pitchfork"
    	},
    	{
    		t: "網",
    		m: "net//network",
    		s: "网"
    	},
    	{
    		t: "鬧",
    		m: "noisy/cacophonous",
    		s: "闹"
    	},
    	{
    		t: "罩",
    		m: "cover"
    	},
    	{
    		t: "璧",
    		m: "jade annulus // bead / marble"
    	},
    	{
    		t: "森",
    		m: "forest"
    	},
    	{
    		t: "林",
    		m: "woods/forest"
    	},
    	{
    		t: "謂",
    		m: "to speak / to say / to tell",
    		s: "谓"
    	},
    	{
    		t: "鉛",
    		m: "lead (chemistry)",
    		s: "铅"
    	},
    	{
    		t: "鑰",
    		m: "key",
    		s: "钥"
    	},
    	{
    		t: "匙",
    		m: "spoon"
    	},
    	{
    		t: "撮",
    		m: "to pick up (a powder etc) with the fingertips"
    	},
    	{
    		t: "鑷",
    		m: "tweezers/forceps",
    		s: "镊"
    	},
    	{
    		t: "踏",
    		m: "to stamp / to step on"
    	},
    	{
    		t: "紋",
    		m: "pattern/mark//line/trace",
    		s: "纹"
    	},
    	{
    		t: "符",
    		m: "mark/sign/symbol"
    	},
    	{
    		t: "錶",
    		m: "wrist or pocket watch",
    		s: "表"
    	},
    	{
    		t: "羊",
    		m: "sheep/goat"
    	},
    	{
    		t: "寧",
    		m: "peaceful",
    		s: "宁"
    	},
    	{
    		t: "你",
    		m: "you"
    	},
    	{
    		t: "胡",
    		m: "non-han people, esp. from central asia"
    	},
    	{
    		t: "扁",
    		m: "flat"
    	},
    	{
    		t: "菓",
    		m: "variant of 果"
    	},
    	{
    		t: "狹",
    		m: "narrow//narrow-minded",
    		s: "狭"
    	},
    	{
    		t: "窄",
    		m: "narrow//narrow-minded/badly off"
    	},
    	{
    		t: "甚",
    		m: "what"
    	},
    	{
    		t: "麼",
    		m: "what ?",
    		s: "么"
    	},
    	{
    		t: "拜",
    		m: "worship//to pay respect"
    	},
    	{
    		t: "繩",
    		m: "rope",
    		s: "绳"
    	},
    	{
    		t: "錨",
    		m: "anchor",
    		s: "锚"
    	},
    	{
    		t: "彫",
    		m: "variant of 雕",
    		s: "雕"
    	},
    	{
    		t: "雕",
    		m: "to carve / to engrave"
    	},
    	{
    		t: "碗",
    		m: "bowl // cup"
    	},
    	{
    		t: "膠",
    		m: "glue//gum/rubber",
    		s: "胶"
    	},
    	{
    		t: "龕",
    		m: "niche // shrine",
    		s: "龛"
    	},
    	{
    		t: "焚",
    		m: "to burn"
    	},
    	{
    		t: "勺",
    		m: "ladle/spoon"
    	},
    	{
    		t: "鉗",
    		m: "pincers",
    		s: "钳"
    	},
    	{
    		t: "紅",
    		m: "red//revolutionary",
    		s: "红"
    	},
    	{
    		t: "柴",
    		m: "firewood"
    	},
    	{
    		t: "襪",
    		m: "socks/stockings",
    		s: "袜"
    	},
    	{
    		t: "笛",
    		m: "flute"
    	},
    	{
    		t: "縱",
    		m: "vertical",
    		s: "纵"
    	},
    	{
    		t: "駕",
    		m: "to pilot // to ride // to sail",
    		s: "驾"
    	},
    	{
    		t: "駛",
    		m: "to gallop//to pilot (plane, ship, etc...)//to sail",
    		s: "驶"
    	},
    	{
    		t: "橡",
    		m: "oak/Quercus serrata"
    	},
    	{
    		t: "纜",
    		m: "cable/hawser",
    		s: "缆"
    	},
    	{
    		t: "蛇",
    		m: "snake/serpent"
    	},
    	{
    		t: "杯",
    		m: "cup//trophy cup"
    	},
    	{
    		t: "狩",
    		m: "to hunt/to go hunting"
    	},
    	{
    		t: "墟",
    		m: "ruins"
    	},
    	{
    		t: "昆",
    		m: "descendant"
    	},
    	{
    		t: "獅",
    		m: "lion",
    		s: "狮"
    	},
    	{
    		t: "鉤",
    		m: "hook",
    		s: "钩"
    	},
    	{
    		t: "釘",
    		m: "nail//spike",
    		s: "钉"
    	},
    	{
    		t: "蠅",
    		m: "fly/musca",
    		s: "蝇"
    	},
    	{
    		t: "錘",
    		m: "hammer",
    		s: "锤"
    	},
    	{
    		t: "蹄",
    		m: "hoof//pig's trotters"
    	},
    	{
    		t: "斗",
    		m: "abbr. for the big dipper constellation 北斗星 // cup or dipper shaped object"
    	},
    	{
    		t: "鐲",
    		m: "bracelet",
    		s: "镯"
    	},
    	{
    		t: "蜜",
    		m: "honey"
    	},
    	{
    		t: "娃",
    		m: "baby//doll"
    	},
    	{
    		t: "煎",
    		m: "to pan fry / to sauté"
    	},
    	{
    		t: "股",
    		m: "share/portion//union of strips together (e.g. noodles, muscle fibers, wires, ...)"
    	},
    	{
    		t: "菜",
    		m: "vegetable//cuisine//dish (type of food)"
    	},
    	{
    		t: "什",
    		m: "ten//assorted/miscellaneous | what"
    	},
    	{
    		t: "錦",
    		m: "brocade/embroidered work",
    		s: "锦"
    	},
    	{
    		t: "炒",
    		m: "to sauté / to stir-fry"
    	},
    	{
    		t: "饂",
    		m: "(kanji) Japanese noodles made from wheat"
    	},
    	{
    		t: "飩",
    		m: "Chinese ravioli//Japanese noodles//pronunciation ton or don",
    		s: "饨"
    	},
    	{
    		t: "饅",
    		m: "steamed bread",
    		s: "馒"
    	},
    	{
    		t: "餛",
    		m: "Chinese ravioli",
    		s: "馄"
    	},
    	{
    		t: "餃",
    		m: "dumplings with meat filling",
    		s: "饺"
    	},
    	{
    		t: "蕎",
    		m: "buckwheat",
    		s: "荞"
    	},
    	{
    		t: "松",
    		m: "pine"
    	},
    	{
    		t: "蒜",
    		m: "garlic"
    	},
    	{
    		t: "蘋",
    		m: "apple",
    		s: "苹"
    	},
    	{
    		t: "碎",
    		m: "to break down/to break into pieces"
    	},
    	{
    		t: "朽",
    		m: "rotten"
    	},
    	{
    		t: "骰",
    		m: "dice"
    	},
    	{
    		t: "抹",
    		m: "to wipe/to erase/to smear"
    	},
    	{
    		t: "柄",
    		m: "handle/shaft"
    	},
    	{
    		t: "舵",
    		m: "helm/rudder"
    	},
    	{
    		t: "岸",
    		m: "shore/beach/coast/bank"
    	},
    	{
    		t: "鼓",
    		m: "drum//to drum/to strike"
    	},
    	{
    		t: "臉",
    		m: "face",
    		s: "脸"
    	},
    	{
    		t: "頁",
    		m: "page//leaf",
    		s: "页"
    	},
    	{
    		t: "窩",
    		m: "nest",
    		s: "窝"
    	},
    	{
    		t: "玄",
    		m: "black//mysterious"
    	},
    	{
    		t: "讚",
    		m: "variant of 贊",
    		s: "赞"
    	},
    	{
    		t: "悶",
    		m: "bored/depressed//melancholy",
    		s: "闷"
    	},
    	{
    		t: "秩",
    		m: "orderliness/order"
    	},
    	{
    		t: "序",
    		m: "order/sequence//preface"
    	},
    	{
    		t: "啤",
    		m: "beer"
    	},
    	{
    		t: "套",
    		m: "cover//to overlap//to encase"
    	},
    	{
    		t: "雀",
    		m: "small bird//sparrow"
    	},
    	{
    		t: "鏟",
    		m: "to shovel // to remove // spade/shovel",
    		s: "铲"
    	},
    	{
    		t: "柳",
    		m: "willow"
    	},
    	{
    		t: "綹",
    		m: "skein (e.g. hair, wool, ...) /tuft//lock",
    		s: "绺"
    	},
    	{
    		t: "瘋",
    		m: "insane/mad/wild",
    		s: "疯"
    	},
    	{
    		t: "錐",
    		m: "cone//awl//to bore",
    		s: "锥"
    	},
    	{
    		t: "銬",
    		m: "shackles/fetters/manacle",
    		s: "铐"
    	},
    	{
    		t: "蝸",
    		m: "snail",
    		s: "蜗"
    	},
    	{
    		t: "烏",
    		m: "crow//black",
    		s: "乌"
    	},
    	{
    		t: "龜",
    		m: "tortoise/turtle",
    		s: "龟"
    	},
    	{
    		t: "蘑",
    		m: "mushroom"
    	},
    	{
    		t: "菇",
    		m: "mushroom"
    	},
    	{
    		t: "蝙",
    		m: "bat"
    	},
    	{
    		t: "蝠",
    		m: "bat"
    	},
    	{
    		t: "棒",
    		m: "stick/club//cudgel//capable/smart//wonderful"
    	},
    	{
    		t: "玉",
    		m: "jade"
    	},
    	{
    		t: "閣",
    		m: "pavilion (usu. two-storied) // cabinet (politics)",
    		s: "阁"
    	},
    	{
    		t: "塗",
    		m: "to smear/to daub/to blot out//to scribble/to scrawl//street",
    		s: "涂"
    	},
    	{
    		t: "肅",
    		m: "respectful/solemn",
    		s: "肃"
    	},
    	{
    		t: "幾",
    		m: "almost|several/a few",
    		s: "几"
    	},
    	{
    		t: "乎",
    		m: "in//at//from//because//than"
    	},
    	{
    		t: "煉",
    		m: "to refine/to smelt",
    		s: "炼"
    	},
    	{
    		t: "漸",
    		m: "gradual/gradually",
    		s: "渐"
    	},
    	{
    		t: "帥",
    		m: "commander-in-chief",
    		s: "帅"
    	},
    	{
    		t: "舌",
    		m: "tongue"
    	},
    	{
    		t: "袋",
    		m: "pouch/bag/sack/pocket"
    	},
    	{
    		t: "懶",
    		m: "lazy",
    		s: "懒"
    	},
    	{
    		t: "揚",
    		m: "to raise/to hoist",
    		s: "扬"
    	},
    	{
    		t: "蔥",
    		m: "scallion/green onion/welsh onion",
    		s: "葱"
    	},
    	{
    		t: "南",
    		m: "south"
    	},
    	{
    		t: "瓜",
    		m: "melon/gourd/squash"
    	},
    	{
    		t: "釋",
    		m: "to explain",
    		s: "释"
    	},
    	{
    		t: "兵",
    		m: "soldiers//a force//an army"
    	},
    	{
    		t: "朵",
    		m: "earlobe"
    	},
    	{
    		t: "摩",
    		m: "to rub"
    	},
    	{
    		t: "羯",
    		m: "ram"
    	},
    	{
    		t: "鈴",
    		m: "(small) bell",
    		s: "铃"
    	},
    	{
    		t: "簧",
    		m: "metallic reed//spring of lock"
    	},
    	{
    		t: "吻",
    		m: "mouth//kiss//to kiss"
    	},
    	{
    		t: "癩",
    		m: "scabies/skin disease",
    		s: "癞"
    	},
    	{
    		t: "蛤",
    		m: "frog/toad"
    	},
    	{
    		t: "蟆",
    		m: "toad"
    	},
    	{
    		t: "伙",
    		m: "meals//variant of 夥"
    	},
    	{
    		t: "何",
    		m: "what / how / why / which"
    	},
    	{
    		t: "那",
    		m: "that/those//then (in that case)"
    	},
    	{
    		t: "起",
    		m: "to rise / to raise / to get up // classifier for groups (batch, group, etc...)//to initiate (action)/to start//starting from (a time, a place, ...)"
    	},
    	{
    		t: "嗯",
    		m: "(groaning sound)"
    	},
    	{
    		t: "雖",
    		m: "although/even though",
    		s: "虽"
    	},
    	{
    		t: "為",
    		m: "as|because of//for/to",
    		s: "为"
    	},
    	{
    		t: "倍",
    		m: "times (multiplier) / double / multiply"
    	},
    	{
    		t: "估",
    		m: "estimate"
    	},
    	{
    		t: "遭",
    		m: "to meet by chance (usually with misfortune)"
    	},
    	{
    		t: "竅",
    		m: "hole/opening//orifice// (fig.) key (to the solution of a problem)",
    		s: "窍"
    	},
    	{
    		t: "剛",
    		m: "strong//just/barely",
    		s: "刚"
    	},
    	{
    		t: "傢",
    		m: "variant of 家",
    		s: "家"
    	},
    	{
    		t: "夥",
    		m: "companion/partner//together",
    		s: "伙"
    	},
    	{
    		t: "艇",
    		m: "small ship//vessel"
    	},
    	{
    		t: "嶼",
    		m: "islet",
    		s: "屿"
    	},
    	{
    		t: "島",
    		m: "island",
    		s: "岛"
    	},
    	{
    		t: "剩",
    		m: "to remain/to be left"
    	},
    	{
    		t: "叫",
    		m: "to be called"
    	},
    	{
    		t: "爸",
    		m: "father/dad/pa/papa"
    	},
    	{
    		t: "醉",
    		m: "intoxicated"
    	},
    	{
    		t: "竟",
    		m: "actually/indeed"
    	},
    	{
    		t: "隨",
    		m: "to follow//to allow",
    		s: "随"
    	},
    	{
    		t: "也",
    		m: "also/too"
    	},
    	{
    		t: "怎",
    		m: "how"
    	},
    	{
    		t: "而",
    		m: "and/as well//but (not)/yet (not)// (indicates causal relation) / and so"
    	},
    	{
    		t: "謊",
    		m: "lies//to lie",
    		s: "谎"
    	},
    	{
    		t: "厭",
    		m: "to loathe",
    		s: "厌"
    	},
    	{
    		t: "覈",
    		m: "to investigate / to examine / to check / to verify // variant of 核",
    		s: "核"
    	},
    	{
    		t: "夠",
    		m: "to reach // to be enough",
    		s: "够"
    	},
    	{
    		t: "僱",
    		m: "to employ / to hire",
    		s: "雇"
    	},
    	{
    		t: "篩",
    		m: "to filter / to sieve / to sift",
    		s: "筛"
    	},
    	{
    		t: "徑",
    		m: "track/footpath",
    		s: "径"
    	},
    	{
    		t: "胞",
    		m: "placenta/womb//born of the same parents"
    	},
    	{
    		t: "冲",
    		m: "to mix with water / to infuse"
    	},
    	{
    		t: "蠢",
    		m: "stupid//sluggish//clumsy/to move in a disorderly fashion"
    	},
    	{
    		t: "坦",
    		m: "flat/level//smooth//open-hearted"
    	},
    	{
    		t: "瘀",
    		m: "hematoma/extravasated blood"
    	},
    	{
    		t: "喜",
    		m: "to be fond of/to like/to enjoy//to be happy//happiness/delight/glad"
    	},
    	{
    		t: "姨",
    		m: "aunt/mother's sister"
    	},
    	{
    		t: "阻",
    		m: "to hinder/to block/to obstruct"
    	},
    	{
    		t: "翻",
    		m: "to turn over/to flip over/to overturn//to translate/to decode"
    	},
    	{
    		t: "幫",
    		m: "to help / to assist/to support",
    		s: "帮"
    	},
    	{
    		t: "忙",
    		m: "busy//to hurry/ to rush//hurriedly"
    	},
    	{
    		t: "哇",
    		m: "Wow!"
    	},
    	{
    		t: "拿",
    		m: "to hold / to seize / to catch"
    	},
    	{
    		t: "碰",
    		m: "to bump // to touch // to meet with"
    	},
    	{
    		t: "逢",
    		m: "to meet by chance/to come across/to fawn upon"
    	},
    	{
    		t: "魯",
    		m: "stupid/rude//crass",
    		s: "鲁"
    	},
    	{
    		t: "莽",
    		m: "impertinent"
    	},
    	{
    		t: "溺",
    		m: "to drown"
    	},
    	{
    		t: "抓",
    		m: "to scratch//to grab/to catch/to snatch//to arrest"
    	},
    	{
    		t: "歉",
    		m: "to apology/to regret//deficient"
    	},
    	{
    		t: "箭",
    		m: "arrow"
    	},
    	{
    		t: "灣",
    		m: "bay/gulf//to cast anchor",
    		s: "湾"
    	},
    	{
    		t: "框",
    		m: "frame (e.g. door frame) // casing // framework"
    	},
    	{
    		t: "鶴",
    		m: "crane",
    		s: "鹤"
    	},
    	{
    		t: "嘴",
    		m: "mouth//beak//nozzle//spout (e.g. of a teapot)"
    	},
    	{
    		t: "盒",
    		m: "small box/case"
    	},
    	{
    		t: "孩",
    		m: "child"
    	},
    	{
    		t: "佛",
    		m: "Buddha//Buddhism"
    	},
    	{
    		t: "鵝",
    		m: "goose",
    		s: "鹅"
    	},
    	{
    		t: "裙",
    		m: "skirt"
    	},
    	{
    		t: "罐",
    		m: "can/jar/pot"
    	},
    	{
    		t: "甕",
    		m: "pottery container (for water, wine, etc...)",
    		s: "瓮"
    	},
    	{
    		t: "紳",
    		m: "member of gentry",
    		s: "绅"
    	},
    	{
    		t: "盲",
    		m: "blind"
    	},
    	{
    		t: "獸",
    		m: "beast/animal//beastly/bestial",
    		s: "兽"
    	},
    	{
    		t: "矩",
    		m: "rule/regulation//carpenter's square"
    	},
    	{
    		t: "吧",
    		m: "...right ? / ...ok ?"
    	},
    	{
    		t: "賬",
    		m: "account/bill//debt",
    		s: "账"
    	},
    	{
    		t: "碼",
    		m: "number/code//weight//to pile/to stack",
    		s: "码"
    	},
    	{
    		t: "註",
    		m: "to register / to annotate // note / comment",
    		s: "注"
    	},
    	{
    		t: "跑",
    		m: "to run // to run away / to escape // to run around (on errands) // (of a gas or liquid) to leak or evaporate"
    	},
    	{
    		t: "熊",
    		m: "bear//to scold/to rebuke//brilliant light/to shine brightly"
    	},
    	{
    		t: "狐",
    		m: "fox"
    	},
    	{
    		t: "牠",
    		m: "it (used for animals)"
    	},
    	{
    		t: "丟",
    		m: "to lose//to put aside//to throw",
    		s: "丢"
    	},
    	{
    		t: "垃",
    		m: "trash"
    	},
    	{
    		t: "圾",
    		m: "clod"
    	},
    	{
    		t: "籃",
    		m: "basket/goal",
    		s: "篮"
    	},
    	{
    		t: "斫",
    		m: "to chop/to hack//to carve wood"
    	},
    	{
    		t: "甜",
    		m: "sweet"
    	},
    	{
    		t: "垂",
    		m: "to hang (down)/to bend down"
    	},
    	{
    		t: "鄭",
    		m: "Zheng state during the Warring States period",
    		s: "郑"
    	},
    	{
    		t: "嘛",
    		m: "modal particle indicating that sth is obvious / particle indicating a pause for emphasis"
    	},
    	{
    		t: "攀",
    		m: "to climb (by pulling oneself up)"
    	},
    	{
    		t: "遮",
    		m: "to cover up / to screen off//to hide/to conceal"
    	},
    	{
    		t: "惟",
    		m: "-ism/only"
    	},
    	{
    		t: "享",
    		m: "to enjoy/to benefit//to have the use of"
    	},
    	{
    		t: "唱",
    		m: "to sing/to chant//to call loudly"
    	},
    	{
    		t: "誓",
    		m: "to swear/to pledge//oath/vow"
    	},
    	{
    		t: "不",
    		m: "variant of 不"
    	},
    	{
    		t: "磣",
    		m: "unsightly//gritty (of food)",
    		s: "碜"
    	},
    	{
    		t: "典",
    		m: "ceremony//to be in charge of"
    	},
    	{
    		t: "俳",
    		m: "not serious//variety show"
    	},
    	{
    		t: "腹",
    		m: "abdomen/stomach/belly"
    	},
    	{
    		t: "摘",
    		m: "to pick (flowers, fruits, etc...) / to pluck // to select//to remove/to take off (glasses, hat, etc...)"
    	},
    	{
    		t: "旨",
    		m: "purpose/aim"
    	},
    	{
    		t: "苛",
    		m: "severe//exacting"
    	},
    	{
    		t: "抗",
    		m: "to resist/to fight/to defy//anti-"
    	},
    	{
    		t: "翼",
    		m: "wing"
    	},
    	{
    		t: "唆",
    		m: "to incite/to encourage/to excite/to stir up"
    	},
    	{
    		t: "伸",
    		m: "to stretch/to extend"
    	},
    	{
    		t: "累",
    		m: "to accumulate//continuous/repeated"
    	},
    	{
    		t: "硬",
    		m: "hard/stiff/strong/firm//resolutely"
    	},
    	{
    		t: "涉",
    		m: "to wade//to be involved/to concern//to experience"
    	},
    	{
    		t: "熾",
    		m: "to burn/to blaze//splendid",
    		s: "炽"
    	},
    	{
    		t: "貧",
    		m: "poor//inadequate//deficient",
    		s: "贫"
    	},
    	{
    		t: "抵",
    		m: "to press against/to support/to prop up/to resist//to arrive at"
    	},
    	{
    		t: "飜",
    		m: "variant of 翻",
    		s: "翻"
    	},
    	{
    		t: "臨",
    		m: "to arrive//to be (just) about to/just before",
    		s: "临"
    	},
    	{
    		t: "催",
    		m: "to urge/to press//to rush sb//to hasten sth//to prompt"
    	},
    	{
    		t: "淚",
    		m: "tears",
    		s: "泪"
    	},
    	{
    		t: "曜",
    		m: "bright/glorious//one of the seven planets of pre-modern astronomy"
    	},
    	{
    		t: "憂",
    		m: "to worry/to concern oneself with//anxiety/sorrow//worried",
    		s: "忧"
    	},
    	{
    		t: "削",
    		m: "to reduce//to remove/to pare"
    	},
    	{
    		t: "繪",
    		m: "to draw/to paint",
    		s: "绘"
    	},
    	{
    		t: "歲",
    		m: "year//classifier for years (of age)",
    		s: "岁"
    	},
    	{
    		t: "促",
    		m: "urgent/hurried//to urge (haste)"
    	},
    	{
    		t: "覆",
    		m: "to cover//to overflow"
    	},
    	{
    		t: "郊",
    		m: "suburbs/outskirts"
    	},
    	{
    		t: "撤",
    		m: "to remove//to take away/to withdraw"
    	},
    	{
    		t: "竹",
    		m: "bamboo"
    	},
    	{
    		t: "峙",
    		m: "peak//to store"
    	},
    	{
    		t: "借",
    		m: "to lend/to borrow//by means of"
    	},
    	{
    		t: "妻",
    		m: "wife"
    	},
    	{
    		t: "媽",
    		m: "ma/mom/mother",
    		s: "妈"
    	},
    	{
    		t: "吃",
    		m: "to eat/to consume"
    	},
    	{
    		t: "狗",
    		m: "dog"
    	},
    	{
    		t: "租",
    		m: "to hire/to rent (out)/to lease (out)//rent"
    	},
    	{
    		t: "礎",
    		m: "foundation/base",
    		s: "础"
    	},
    	{
    		t: "括",
    		m: "to enclose//to include"
    	},
    	{
    		t: "弧",
    		m: "arc"
    	},
    	{
    		t: "嗎",
    		m: "(question particle for \"yes-no\" questions)",
    		s: "吗"
    	},
    	{
    		t: "籤",
    		m: "label/tag//inscribed bamboo stick",
    		s: "签"
    	},
    	{
    		t: "馭",
    		m: "variant of 御//to control/to drive/to manage",
    		s: "驭"
    	},
    	{
    		t: "呈",
    		m: "to present to a superior/to present (a certain appearance)"
    	},
    	{
    		t: "爪",
    		m: "claw"
    	},
    	{
    		t: "京",
    		m: "capital city of a country"
    	},
    	{
    		t: "皆",
    		m: "all/each and every//in all cases"
    	},
    	{
    		t: "勉",
    		m: "to exhort/to make an effort"
    	},
    	{
    		t: "亞",
    		m: "Asia/Asian//second/next to/inferior/sub-",
    		s: "亚"
    	},
    	{
    		t: "洲",
    		m: "continent//island in a river"
    	},
    	{
    		t: "鯨",
    		m: "whale",
    		s: "鲸"
    	},
    	{
    		t: "牌",
    		m: "playing card//game pieces"
    	},
    	{
    		t: "它",
    		m: "it"
    	},
    	{
    		t: "做",
    		m: "to do / to make / to produce"
    	},
    	{
    		t: "矮",
    		m: "low/short (in length)"
    	},
    	{
    		t: "哈",
    		m: "laughter"
    	},
    	{
    		t: "挺",
    		m: "quite/very"
    	},
    	{
    		t: "鳳",
    		m: "phoenix",
    		s: "凤"
    	},
    	{
    		t: "梨",
    		m: "pear"
    	},
    	{
    		t: "州",
    		m: "state (e.g. of US)"
    	},
    	{
    		t: "鍋",
    		m: "pot / pan / boiler",
    		s: "锅"
    	},
    	{
    		t: "麽",
    		m: "variant of 麼"
    	},
    	{
    		t: "咆",
    		m: "to roar"
    	},
    	{
    		t: "哮",
    		m: "pant/roar/bark (of animals)"
    	},
    	{
    		t: "按",
    		m: "to press/to push//to check/to refer to//according to/in the light of"
    	},
    	{
    		t: "某",
    		m: "some/a certain/sb or sth indefinite"
    	},
    	{
    		t: "牢",
    		m: "prison"
    	},
    	{
    		t: "泥",
    		m: "mud/clay//paste//pulp"
    	},
    	{
    		t: "棍",
    		m: "stick/rod/truncheon"
    	},
    	{
    		t: "鍬",
    		m: "shovel//spade",
    		s: "锹"
    	},
    	{
    		t: "鈕",
    		m: "button",
    		s: "钮"
    	},
    	{
    		t: "斧",
    		m: "hatchet"
    	},
    	{
    		t: "剝",
    		m: "to peel/to skin/to shell/to shuck",
    		s: "剥"
    	},
    	{
    		t: "繽",
    		m: "mixed colors//in confusion//helter-skelter",
    		s: "缤"
    	},
    	{
    		t: "瀑",
    		m: "waterfall"
    	},
    	{
    		t: "找",
    		m: "to try to find/to look for/to seek"
    	},
    	{
    		t: "礫",
    		m: "gravel/small stone",
    		s: "砾"
    	},
    	{
    		t: "唇",
    		m: "lip"
    	},
    	{
    		t: "游",
    		m: "variant of 遊"
    	},
    	{
    		t: "鎬",
    		m: "a pick",
    		s: "镐"
    	},
    	{
    		t: "挖",
    		m: "to dig/to excavate//to scoop out"
    	},
    	{
    		t: "升",
    		m: "to ascend/to rise to the rank of//to promote"
    	},
    	{
    		t: "夜",
    		m: "night"
    	},
    	{
    		t: "蜘",
    		m: "spider"
    	},
    	{
    		t: "蛛",
    		m: "spider"
    	},
    	{
    		t: "畜",
    		m: "to raise (animals)"
    	},
    	{
    		t: "牧",
    		m: "to breed livestock//to herd"
    	},
    	{
    		t: "臂",
    		m: "arm"
    	},
    	{
    		t: "盆",
    		m: "flower pot//basin"
    	},
    	{
    		t: "胸",
    		m: "chest/thorax/bosom"
    	},
    	{
    		t: "澆",
    		m: "to pour liquid // to irrigate / to water",
    		s: "浇"
    	},
    	{
    		t: "鋤",
    		m: "a hoe//to hoe/to dig//to weed/to get rid of",
    		s: "锄"
    	},
    	{
    		t: "鋒",
    		m: "edge of a tool//point of a spear",
    		s: "锋"
    	},
    	{
    		t: "砍",
    		m: "to chop / to cut down"
    	},
    	{
    		t: "樁",
    		m: "stump//stake/pile",
    		s: "桩"
    	},
    	{
    		t: "盡",
    		m: "to use up / to exhaust // to end / to finish // exhausted",
    		s: "尽"
    	},
    	{
    		t: "朋",
    		m: "friend"
    	},
    	{
    		t: "磚",
    		m: "brick",
    		s: "砖"
    	},
    	{
    		t: "鎢",
    		m: "tungsten (chemistry)",
    		s: "钨"
    	},
    	{
    		t: "吊",
    		m: "to suspend/to hang up // to hang up a person"
    	},
    	{
    		t: "壺",
    		m: "pot",
    		s: "壶"
    	},
    	{
    		t: "版",
    		m: "edition/version//page"
    	},
    	{
    		t: "鍵",
    		m: "key/button",
    		s: "键"
    	},
    	{
    		t: "渲",
    		m: "wash (color)"
    	},
    	{
    		t: "您",
    		m: "you (courteous, as opposed to informal 你)"
    	},
    	{
    		t: "亮",
    		m: "bright/clear//to shine"
    	},
    	{
    		t: "曝",
    		m: "to air/to sun"
    	},
    	{
    		t: "幀",
    		m: "frame//classifier for paintings etc"
    	},
    	{
    		t: "擁",
    		m: "to hold//to embrace/to wrap around",
    		s: "拥"
    	},
    	{
    		t: "墜",
    		m: "to fall/to drop//to weigh down",
    		s: "坠"
    	},
    	{
    		t: "戾",
    		m: "to bend//to violate//to go against//ruthless and tyrannical"
    	},
    	{
    		t: "瀧",
    		m: "waterfalls//rapids",
    		s: "泷"
    	},
    	{
    		t: "艱",
    		m: "difficult/hardship/hard",
    		s: "艰"
    	},
    	{
    		t: "宵",
    		m: "night"
    	},
    	{
    		t: "睡",
    		m: "to sleep/to lie down"
    	},
    	{
    		t: "株",
    		m: "tree trunk/stump (tree root)"
    	},
    	{
    		t: "寢",
    		m: "to lie down",
    		s: "寝"
    	},
    	{
    		t: "遷",
    		m: "to move/to shift/to change",
    		s: "迁"
    	},
    	{
    		t: "醬",
    		m: "thick paste of fermented soybean//paste",
    		s: "酱"
    	},
    	{
    		t: "煮",
    		m: "to cook/to boil"
    	},
    	{
    		t: "燒",
    		m: "to cook//to boil//to bake//to roast//to stew//to burn",
    		s: "烧"
    	},
    	{
    		t: "沸",
    		m: "to boil"
    	},
    	{
    		t: "刺",
    		m: "thorn/sting/thrust//to prick/to pierce//to stab//to assassinate/to murder"
    	},
    	{
    		t: "戟",
    		m: "halberd/long handled weapon with pointed tip and crescent blade"
    	},
    	{
    		t: "喝",
    		m: "to drink"
    	},
    	{
    		t: "淨",
    		m: "clean",
    		s: "净"
    	},
    	{
    		t: "鹽",
    		m: "salt",
    		s: "盐"
    	},
    	{
    		t: "攝",
    		m: "to take in/to absorb//to assimilate//to take a photo//photo/photo shoot",
    		s: "摄"
    	},
    	{
    		t: "拍",
    		m: "to pat/to clap/to slap//to take (a photo)//to shoot (a film)"
    	},
    	{
    		t: "藻",
    		m: "aquatic grasses//elegant"
    	},
    	{
    		t: "牡",
    		m: "(of a bird, animal or plant) male"
    	},
    	{
    		t: "蠣",
    		m: "oyster",
    		s: "蛎"
    	},
    	{
    		t: "丼",
    		m: "bowl of food//well"
    	},
    	{
    		t: "犬",
    		m: "dog"
    	},
    	{
    		t: "吠",
    		m: "to bark"
    	},
    	{
    		t: "且",
    		m: "and/moreover/yet"
    	},
    	{
    		t: "津",
    		m: "saliva//sweat"
    	},
    	{
    		t: "薑",
    		m: "ginger",
    		s: "姜"
    	},
    	{
    		t: "倭",
    		m: "Japanese (old)"
    	},
    	{
    		t: "酵",
    		m: "fermentation/leavening//yeast"
    	},
    	{
    		t: "菌",
    		m: "germ/bacteria/fungus/mold"
    	},
    	{
    		t: "麴",
    		m: "yeast/levure//aspergillus (includes many common molds)//variant of 曲1",
    		s: "曲"
    	},
    	{
    		t: "噌",
    		m: "to scold"
    	},
    	{
    		t: "穀",
    		m: "grain/corn",
    		s: "谷"
    	},
    	{
    		t: "坊",
    		m: "workshop/mill"
    	},
    	{
    		t: "泡",
    		m: "bubble/foam//to soak/to steep//to infuse"
    	},
    	{
    		t: "膨",
    		m: "swollen"
    	},
    	{
    		t: "脹",
    		m: "dropsical/swollen//to swell/to be bloated",
    		s: "胀"
    	},
    	{
    		t: "掉",
    		m: "to fall/to drop//to lag behind/to lose"
    	},
    	{
    		t: "熬",
    		m: "to cook on a slow fire//to extract by heating/to decoct//to endure"
    	},
    	{
    		t: "捏",
    		m: "to pinch (with one's fingers)//to knead//to make up"
    	},
    	{
    		t: "稍",
    		m: "somewhat//a little"
    	},
    	{
    		t: "攪",
    		m: "to stir/to mix//to disturb//to annoy",
    		s: "搅"
    	},
    	{
    		t: "米",
    		m: "rice//meter"
    	},
    	{
    		t: "蒸",
    		m: "to evaporate//(of cooking) to steam"
    	},
    	{
    		t: "又",
    		m: "also"
    	},
    	{
    		t: "櫱",
    		m: "new shoot growing from cut branch or stump",
    		s: "蘖"
    	},
    	{
    		t: "麯",
    		m: "yeast"
    	},
    	{
    		t: "粬",
    		m: "variant of 麯"
    	},
    	{
    		t: "糯",
    		m: "glutinous rice/sticky rice"
    	},
    	{
    		t: "糕",
    		m: "cake"
    	},
    	{
    		t: "黍",
    		m: "broomcorn millet/glutinous millet"
    	},
    	{
    		t: "燕",
    		m: "swallow (family hirundinidae)"
    	},
    	{
    		t: "碾",
    		m: "stone roller/roller and millstone//to grind/to crush/to husk"
    	},
    	{
    		t: "霸",
    		m: "hegemon/tyrant/lord/feudal chief//to rule by force"
    	},
    	{
    		t: "糠",
    		m: "husk"
    	},
    	{
    		t: "麩",
    		m: "bran",
    		s: "麸"
    	},
    	{
    		t: "霉",
    		m: "bacteria/fungi/moldy"
    	},
    	{
    		t: "勻",
    		m: "even/well-distributed/uniform//to distribute evenly",
    		s: "匀"
    	},
    	{
    		t: "醃",
    		m: "to salt//to pickle//to cure (meat)//to marinate",
    		s: "腌"
    	},
    	{
    		t: "歌",
    		m: "song//to sing"
    	},
    	{
    		t: "呢",
    		m: "question particle"
    	},
    	{
    		t: "搶",
    		m: "to rob/to snatch/to grab",
    		s: "抢"
    	},
    	{
    		t: "詢",
    		m: "to ask about/to inquire about",
    		s: "询"
    	},
    	{
    		t: "辦",
    		m: "to do/to manage/to handle/to deal with",
    		s: "办"
    	},
    	{
    		t: "欣",
    		m: "happy"
    	},
    	{
    		t: "哦",
    		m: "oh"
    	},
    	{
    		t: "坡",
    		m: "slope/sloping/slanted"
    	},
    	{
    		t: "哥",
    		m: "elder brother"
    	},
    	{
    		t: "湯",
    		m: "soup//hot or boiling water//decoction of medicinal herbs//water in which something has been boiled//stock/국/bouillon//stew",
    		s: "汤"
    	},
    	{
    		t: "扔",
    		m: "to throw/to throw away"
    	},
    	{
    		t: "傻",
    		m: "foolish"
    	},
    	{
    		t: "啊",
    		m: "Ah!/Oh!"
    	},
    	{
    		t: "祈",
    		m: "to implore/to pray/to request"
    	},
    	{
    		t: "禱",
    		m: "prayer/pray/supplication",
    		s: "祷"
    	},
    	{
    		t: "羹",
    		m: "soup"
    	},
    	{
    		t: "克",
    		m: "gram"
    	},
    	{
    		t: "燜",
    		m: "to cook in a covered vessel/to casserole/to stew"
    	},
    	{
    		t: "韭",
    		m: "leek"
    	},
    	{
    		t: "蝦",
    		m: "shrimp/prawn",
    		s: "虾"
    	},
    	{
    		t: "夷",
    		m: "non-Han people/barbarians//to wipe out/to exterminate/to tear down/to raze"
    	},
    	{
    		t: "蠔",
    		m: "oyster",
    		s: "蚝"
    	},
    	{
    		t: "燉",
    		m: "to stew",
    		s: "炖"
    	},
    	{
    		t: "擾",
    		m: "to disturb",
    		s: "扰"
    	},
    	{
    		t: "鹹",
    		m: "salted/salty/stingy/miserly",
    		s: "咸"
    	},
    	{
    		t: "墊",
    		m: "pad/cushion/mat//to pay for sb",
    		s: "垫"
    	},
    	{
    		t: "誰",
    		m: "who",
    		s: "谁"
    	},
    	{
    		t: "蔬",
    		m: "vegetables"
    	},
    	{
    		t: "鄉",
    		m: "country/countryside/native place/home village/home town",
    		s: "乡"
    	},
    	{
    		t: "嚐",
    		m: "to taste",
    		s: "尝"
    	},
    	{
    		t: "豪",
    		m: "grand/heroic"
    	},
    	{
    		t: "拌",
    		m: "to mix/to mix in"
    	},
    	{
    		t: "嫩",
    		m: "soft/tender/delicate//young"
    	},
    	{
    		t: "跟",
    		m: "with/and (in addition to)//to go with//to marry sb"
    	},
    	{
    		t: "呀",
    		m: "(particle equivalent to 啊 after a vowel, expressing surprise or doubt)"
    	},
    	{
    		t: "烤",
    		m: "to roast/to bake/to broil"
    	},
    	{
    		t: "擺",
    		m: "to arrange",
    		s: "摆"
    	},
    	{
    		t: "桌",
    		m: "table"
    	},
    	{
    		t: "鹿",
    		m: "deer"
    	},
    	{
    		t: "鴉",
    		m: "crow",
    		s: "鸦"
    	},
    	{
    		t: "聚",
    		m: "to congregate/to assemble/to mass/to gather together/to amass//to polymerize"
    	},
    	{
    		t: "夾",
    		m: "to sandwich/to place in between/to press from either side//to carry sth under armpit",
    		s: "夹"
    	},
    	{
    		t: "嗨",
    		m: "hey!/hi!"
    	},
    	{
    		t: "笨",
    		m: "stupid/foolish/silly/clumsy"
    	},
    	{
    		t: "藍",
    		m: "blue/indigo plant",
    		s: "蓝"
    	},
    	{
    		t: "寬",
    		m: "wide/broad/lenient",
    		s: "宽"
    	},
    	{
    		t: "塵",
    		m: "dust/dirt/earth",
    		s: "尘"
    	},
    	{
    		t: "埃",
    		m: "dust/dirt"
    	},
    	{
    		t: "爬",
    		m: "to climb//to crawl"
    	},
    	{
    		t: "肩",
    		m: "shoulder//to shoulder"
    	},
    	{
    		t: "膀",
    		m: "upper arm//wing"
    	},
    	{
    		t: "忘",
    		m: "to forget/to overlook/to neglect"
    	},
    	{
    		t: "倔",
    		m: "crabby/tough"
    	},
    	{
    		t: "翅",
    		m: "wing"
    	},
    	{
    		t: "懂",
    		m: "to understand/to comprehend//to know"
    	},
    	{
    		t: "旁",
    		m: "beside//one side/side"
    	},
    	{
    		t: "贏",
    		m: "to beat/to win//to profit",
    		s: "赢"
    	},
    	{
    		t: "另",
    		m: "other/another//separate//separately"
    	},
    	{
    		t: "伍",
    		m: "squad of five soldiers"
    	},
    	{
    		t: "舒",
    		m: "to stretch/to unfold//to relax//leisurely"
    	},
    	{
    		t: "寞",
    		m: "lonesome"
    	},
    	{
    		t: "氛",
    		m: "miasma/vapor"
    	},
    	{
    		t: "奶",
    		m: "breast//milk//to breastfeed"
    	},
    	{
    		t: "辛",
    		m: "hot/pungent//hard/laborious/suffering"
    	},
    	{
    		t: "讓",
    		m: "to yield/to permit/to let sb do sth//to make sb (feel sad etc)",
    		s: "让"
    	},
    	{
    		t: "躲",
    		m: "to hide/to dodge/to avoid"
    	},
    	{
    		t: "尷",
    		m: "embarrassed//ill at ease",
    		s: "尴"
    	},
    	{
    		t: "尬",
    		m: "cripple"
    	},
    	{
    		t: "往",
    		m: "to go (in a direction)//to/towards//past/previous"
    	},
    	{
    		t: "併",
    		m: "to combine/to amalgamate",
    		s: "并"
    	},
    	{
    		t: "喂",
    		m: "hey//to feed"
    	},
    	{
    		t: "群",
    		m: "group/crowd//flock/herd/pack"
    	},
    	{
    		t: "崎",
    		m: "mountainous"
    	},
    	{
    		t: "矢",
    		m: "arrow/dart//straight//to vow/to swear"
    	},
    	{
    		t: "攙",
    		m: "to take by the arm and assist//to blend/to mix//to dilute",
    		s: "搀"
    	},
    	{
    		t: "烹",
    		m: "cooking method//to boil sb alive (capital punishment in Imperial China)"
    	},
    	{
    		t: "卡",
    		m: "to stop/to block//card//cassette//calorie"
    	},
    	{
    		t: "斯",
    		m: "(phonetic)//this"
    	},
    	{
    		t: "綺",
    		m: "beautiful//open-work silk",
    		s: "绮"
    	},
    	{
    		t: "阪",
    		m: "slope/hillside"
    	},
    	{
    		t: "寺",
    		m: "Buddhist temple//Mosque"
    	},
    	{
    		t: "寸",
    		m: "thumb//inch//a unit of length"
    	},
    	{
    		t: "岡",
    		m: "ridge/mound",
    		s: "冈"
    	},
    	{
    		t: "賀",
    		m: "to congratulate",
    		s: "贺"
    	},
    	{
    		t: "貓",
    		m: "cat",
    		s: "猫"
    	},
    	{
    		t: "煩",
    		m: "to bother/to trouble//to feel vexed",
    		s: "烦"
    	},
    	{
    		t: "捨",
    		m: "to give up/to abandon/to give alms",
    		s: "舍"
    	},
    	{
    		t: "瘡",
    		m: "sore/skin ulcer",
    		s: "疮"
    	},
    	{
    		t: "癢",
    		m: "to itch/to tickle",
    		s: "痒"
    	},
    	{
    		t: "蓮",
    		m: "lotus",
    		s: "莲"
    	},
    	{
    		t: "僅",
    		m: "barely/only/merely",
    		s: "仅"
    	},
    	{
    		t: "央",
    		m: "center//end//to beg/to plead"
    	},
    	{
    		t: "喧",
    		m: "clamor/noise"
    	},
    	{
    		t: "嘩",
    		m: "clamor/noise//cat-calling sound",
    		s: "哗"
    	},
    	{
    		t: "遣",
    		m: "to dispatch/to send/to dispel"
    	},
    	{
    		t: "丈",
    		m: "to measure//husband"
    	},
    	{
    		t: "田",
    		m: "field/farm"
    	},
    	{
    		t: "爽",
    		m: "bright/clear//fine/pleasurable/invigorating"
    	},
    	{
    		t: "茄",
    		m: "eggplant"
    	},
    	{
    		t: "脯",
    		m: "chest/breast"
    	},
    	{
    		t: "葫",
    		m: "Allium scorodoprasum//bottle gourd"
    	},
    	{
    		t: "蘆",
    		m: "rush/reed/Phragmites communis",
    		s: "芦"
    	},
    	{
    		t: "丁",
    		m: "cubes (of food)"
    	},
    	{
    		t: "筵",
    		m: "bamboo mat for sitting"
    	},
    	{
    		t: "哭",
    		m: "to cry/to weep"
    	},
    	{
    		t: "勵",
    		m: "to encourage/to urge",
    		s: "励"
    	},
    	{
    		t: "晴",
    		m: "clear weather/fine weather"
    	},
    	{
    		t: "渡",
    		m: "to ferry across (e.g. a river)/to cross/to pass through/to carry across/to traverse"
    	},
    	{
    		t: "浮",
    		m: "to float//to exceed//superfluous"
    	},
    	{
    		t: "暮",
    		m: "evening/dusk/sunset//ending"
    	},
    	{
    		t: "夕",
    		m: "dusk/evening"
    	},
    	{
    		t: "奴",
    		m: "slave"
    	},
    	{
    		t: "酲",
    		m: "hungover//inebriated"
    	},
    	{
    		t: "昔",
    		m: "the past/former times"
    	},
    	{
    		t: "吹",
    		m: "to blow/to play a wind instrument//to puff"
    	},
    	{
    		t: "蝶",
    		m: "butterfly"
    	},
    	{
    		t: "猿",
    		m: "ape"
    	},
    	{
    		t: "頃",
    		m: "a short while/a little while ago",
    		s: "顷"
    	},
    	{
    		t: "君",
    		m: "monarch/lord//gentleman/ruler"
    	},
    	{
    		t: "戶",
    		m: "door//household//family",
    		s: "户"
    	},
    	{
    		t: "摑",
    		m: "to slap",
    		s: "掴"
    	},
    	{
    		t: "瞑",
    		m: "to close (the eyes)"
    	},
    	{
    		t: "締",
    		m: "closely joined//connection/knot",
    		s: "缔"
    	},
    	{
    		t: "鬱",
    		m: "dense (growth)//melancholy",
    		s: "郁"
    	},
    	{
    		t: "乍",
    		m: "at first//suddenly/abruptly"
    	},
    	{
    		t: "馱",
    		m: "to carry on one's back",
    		s: "驮"
    	},
    	{
    		t: "叩",
    		m: "to knock/to kowtow"
    	},
    	{
    		t: "茂",
    		m: "luxuriant"
    	},
    	{
    		t: "澄",
    		m: "clear/limpid//to clarify/to purify"
    	},
    	{
    		t: "仙",
    		m: "immortal"
    	},
    	{
    		t: "詰",
    		m: "to investigate/to restrain/to scold",
    		s: "诘"
    	},
    	{
    		t: "齡",
    		m: "age//length of experience",
    		s: "龄"
    	},
    	{
    		t: "孫",
    		m: "grandson//descendant",
    		s: "孙"
    	},
    	{
    		t: "悟",
    		m: "to comprehend/to become aware//to apprehend"
    	},
    	{
    		t: "薪",
    		m: "fuel//salary"
    	},
    	{
    		t: "懸",
    		m: "to hang or suspend//to worry//unresolved//baseless/without foundation",
    		s: "悬"
    	},
    	{
    		t: "侘",
    		m: "boast/despondent"
    	},
    	{
    		t: "降",
    		m: "to drop/to fall//to come down/to descend"
    	},
    	{
    		t: "僕",
    		m: "servant",
    		s: "仆"
    	},
    	{
    		t: "匹",
    		m: "classifier for horses, mules, etc..."
    	},
    	{
    		t: "丸",
    		m: "ball/pellet/pill"
    	},
    	{
    		t: "崩",
    		m: "to collapse/to fall into ruins//demise"
    	},
    	{
    		t: "霜",
    		m: "frost//white powder or cream spread over a surface"
    	},
    	{
    		t: "婆",
    		m: "grand mother//mother-in-law"
    	},
    	{
    		t: "嫁",
    		m: "(of a woman) to marry//to marry off a daughter"
    	},
    	{
    		t: "免",
    		m: "to excuse sb"
    	},
    	{
    		t: "儘",
    		m: "to the greatest extent//furthest/extreme",
    		s: "尽"
    	},
    	{
    		t: "飼",
    		m: "to raise/to rear/to feed",
    		s: "饲"
    	},
    	{
    		t: "軸",
    		m: "axis/axle",
    		s: "轴"
    	},
    	{
    		t: "伯",
    		m: "father's elder brother//senior"
    	},
    	{
    		t: "迄",
    		m: "as yet/until"
    	},
    	{
    		t: "裸",
    		m: "naked"
    	},
    	{
    		t: "砂",
    		m: "sand/gravel/granule"
    	},
    	{
    		t: "刈",
    		m: "mow"
    	},
    	{
    		t: "斜",
    		m: "inclined/slanting/oblique/tilting"
    	},
    	{
    		t: "屹",
    		m: "high and steep"
    	},
    	{
    		t: "喊",
    		m: "shout/call out/yell/howl/cry"
    	},
    	{
    		t: "宴",
    		m: "to entertain//feast/banquet"
    	},
    	{
    		t: "喉",
    		m: "throat/larynx"
    	},
    	{
    		t: "渴",
    		m: "thirsty"
    	},
    	{
    		t: "溢",
    		m: "to overflow"
    	},
    	{
    		t: "汚",
    		m: "variant of 污"
    	},
    	{
    		t: "予",
    		m: "to give"
    	},
    	{
    		t: "轟",
    		m: "explosion/bang/boom/rumble//to attack//to shoo away/to expel",
    		s: "轰"
    	},
    	{
    		t: "荷",
    		m: "to carry on one's shoulder or back//burden//responsibility"
    	},
    	{
    		t: "憩",
    		m: "to rest"
    	},
    	{
    		t: "鍛",
    		m: "to forge/to discipline//wrought",
    		s: "锻"
    	},
    	{
    		t: "釣",
    		m: "to fish with a hook and bait",
    		s: "钓"
    	},
    	{
    		t: "堀",
    		m: "cave//hole"
    	},
    	{
    		t: "祥",
    		m: "auspicious/propitious"
    	},
    	{
    		t: "爺",
    		m: "grandpa//old gentleman",
    		s: "爷"
    	},
    	{
    		t: "祖",
    		m: "ancestor/grandparents//forefather"
    	},
    	{
    		t: "尻",
    		m: "coccyx/tailbone at end of spine"
    	},
    	{
    		t: "閃",
    		m: "spark/flash//to flash (across one's mind)",
    		s: "闪"
    	},
    	{
    		t: "頑",
    		m: "stubborn/obstinate//stupid//naughty",
    		s: "顽"
    	},
    	{
    		t: "晝",
    		m: "daytime",
    		s: "昼"
    	},
    	{
    		t: "飽",
    		m: "to eat till full//satisfied",
    		s: "饱"
    	},
    	{
    		t: "伝",
    		m: "to summon//to propagate/to transmit"
    	},
    	{
    		t: "哺",
    		m: "to feed"
    	},
    	{
    		t: "並",
    		m: "and/furthermore/also/together with//simultaneously//to combine/to join/to merge",
    		s: "并"
    	},
    	{
    		t: "觸",
    		m: "to touch/to make contact with sth",
    		s: "触"
    	},
    	{
    		t: "盾",
    		m: "shield"
    	},
    	{
    		t: "炎",
    		m: "flame/inflammation//-itis"
    	},
    	{
    		t: "刊",
    		m: "to print//to publish//publication"
    	},
    	{
    		t: "拭",
    		m: "to wipe"
    	},
    	{
    		t: "喋",
    		m: "to chatter//flowing flood"
    	},
    	{
    		t: "滴",
    		m: "a drop//to drip"
    	},
    	{
    		t: "塾",
    		m: "private school"
    	},
    	{
    		t: "織",
    		m: "to weave/to knit",
    		s: "织"
    	},
    	{
    		t: "悼",
    		m: "to mourn/to lament"
    	},
    	{
    		t: "醋",
    		m: "vinegar"
    	},
    	{
    		t: "辰",
    		m: "year of the Dragon"
    	},
    	{
    		t: "嶽",
    		m: "high mountain/highest peak of a mountain ridge",
    		s: "岳"
    	},
    	{
    		t: "毅",
    		m: "firm and resolute/staunch"
    	},
    	{
    		t: "稿",
    		m: "manuscript/draft/stalk of grain"
    	},
    	{
    		t: "獻",
    		m: "to offer/to present//to put on display",
    		s: "献"
    	},
    	{
    		t: "躊",
    		m: "to pace back and forth/to hesitate",
    		s: "踌"
    	},
    	{
    		t: "躇",
    		m: "to hesitate"
    	},
    	{
    		t: "膜",
    		m: "membrane/film"
    	},
    	{
    		t: "猶",
    		m: "as if/(just) like/just as//still/yet"
    	},
    	{
    		t: "粧",
    		m: "variant of 妝",
    		s: "妆"
    	},
    	{
    		t: "杖",
    		m: "staff/rod/cane//walking stick"
    	},
    	{
    		t: "轄",
    		m: "to govern/to control//having jurisdiction over",
    		s: "辖"
    	},
    	{
    		t: "矯",
    		m: "to correct/to rectify/to redress",
    		s: "矫"
    	},
    	{
    		t: "竊",
    		m: "to steal//secretly//(humble) I",
    		s: "窃"
    	},
    	{
    		t: "省",
    		m: "to inspect/to examine/to be aware|to save/to economize//to leave out/to omit/to do without"
    	},
    	{
    		t: "贓",
    		m: "stolen goods/booty/spoils",
    		s: "赃"
    	},
    	{
    		t: "爵",
    		m: "nobility"
    	},
    	{
    		t: "祉",
    		m: "felicity"
    	},
    	{
    		t: "旬",
    		m: "ten days//ten years//full period"
    	},
    	{
    		t: "塌",
    		m: "to collapse/to droop/to settle down"
    	},
    	{
    		t: "返",
    		m: "to return (to)"
    	},
    	{
    		t: "熄",
    		m: "to extinguish/to put out (fire)/to quench//to stop burning/to go out (of a fire etc)//to die out/to come to an end"
    	},
    	{
    		t: "鑄",
    		m: "to cast/to found metals",
    		s: "铸"
    	},
    	{
    		t: "孔",
    		m: "hole"
    	},
    	{
    		t: "疇",
    		m: "class/category",
    		s: "畴"
    	},
    	{
    		t: "跨",
    		m: "to step across/to stride over/to straddle/to span"
    	},
    	{
    		t: "咖",
    		m: "coffee//class/grade"
    	},
    	{
    		t: "吞",
    		m: "to swallow/to take"
    	},
    	{
    		t: "摹",
    		m: "to imitate/to copy"
    	},
    	{
    		t: "嚼",
    		m: "to chew"
    	},
    	{
    		t: "懷",
    		m: "bosom/heart/mind//to think of/to harbor in one's mind",
    		s: "怀"
    	},
    	{
    		t: "譜",
    		m: "chart/list/table/register",
    		s: "谱"
    	},
    	{
    		t: "譽",
    		m: "reputation",
    		s: "誉"
    	},
    	{
    		t: "噹",
    		m: "dong/ding dong",
    		s: "当"
    	},
    	{
    		t: "緯",
    		m: "latitude/woof/weft",
    		s: "纬"
    	},
    	{
    		t: "漂",
    		m: "to drift//to float"
    	},
    	{
    		t: "樸",
    		m: "plain and simple",
    		s: "朴"
    	},
    	{
    		t: "溪",
    		m: "creek/rivulet"
    	},
    	{
    		t: "谷",
    		m: "valley"
    	},
    	{
    		t: "匠",
    		m: "craftsman"
    	},
    	{
    		t: "馳",
    		m: "to disseminate/to spread",
    		s: "驰"
    	},
    	{
    		t: "娛",
    		m: "to amuse",
    		s: "娱"
    	},
    	{
    		t: "蕪",
    		m: "overgrown with weeds",
    		s: "芜"
    	},
    	{
    		t: "售",
    		m: "to sell"
    	},
    	{
    		t: "夏",
    		m: "summer"
    	},
    	{
    		t: "礁",
    		m: "reef/shoal rock"
    	},
    	{
    		t: "擱",
    		m: "to place//to shelve//to put aside",
    		s: "搁"
    	},
    	{
    		t: "淺",
    		m: "shallow/light (color)",
    		s: "浅"
    	},
    	{
    		t: "款",
    		m: "section/paragraph/funds//classifier for versions or models (of a product)"
    	},
    	{
    		t: "歐",
    		m: "Europe",
    		s: "欧"
    	},
    	{
    		t: "軌",
    		m: "course/path/track/rail",
    		s: "轨"
    	},
    	{
    		t: "曆",
    		m: "calendar",
    		s: "历"
    	},
    	{
    		t: "鑽",
    		m: "to drill/to bore//to make one's way into/to enter//to dig into|diamond//auger",
    		s: "钻"
    	},
    	{
    		t: "陶",
    		m: "pottery"
    	},
    	{
    		t: "紡",
    		m: "to spin (cotton or hemp etc)//fine woven silk fabric",
    		s: "纺"
    	},
    	{
    		t: "滾",
    		m: "to roll//to take a hike//to boil",
    		s: "滚"
    	},
    	{
    		t: "勁",
    		m: "strength/energy/spirit/mood/expression/enthusiasm",
    		s: "劲"
    	},
    	{
    		t: "曾",
    		m: "former/previously//once/already"
    	},
    	{
    		t: "控",
    		m: "to control"
    	},
    	{
    		t: "瀏",
    		m: "clear//deep (of water)//swift",
    		s: "浏"
    	},
    	{
    		t: "噪",
    		m: "the chirping of birds or insects/buzzing//noise//disturbance"
    	},
    	{
    		t: "聊",
    		m: "to chat"
    	},
    	{
    		t: "撞",
    		m: "to knock against//to bump into/to run into//to meet by accident"
    	},
    	{
    		t: "啡",
    		m: "(phonetic component)"
    	},
    	{
    		t: "諸",
    		m: "all/various",
    		s: "诸"
    	},
    	{
    		t: "裔",
    		m: "descendants//frontier"
    	},
    	{
    		t: "歧",
    		m: "divergent/side road"
    	},
    	{
    		t: "罷",
    		m: "to stop/to cease/to dismiss/to suspend/to quit/to finish",
    		s: "罢"
    	},
    	{
    		t: "卻",
    		m: "but/yet/however/nevertheless",
    		s: "却"
    	},
    	{
    		t: "娘",
    		m: "mother//young lady"
    	},
    	{
    		t: "篡",
    		m: "to seize//to usurp"
    	},
    	{
    		t: "筐",
    		m: "basket"
    	},
    	{
    		t: "鼴",
    		m: "mole",
    		s: "鼹"
    	},
    	{
    		t: "曬",
    		m: "(of the sun) to shine on//to bask in (the sunshine)//to expose and share (web)",
    		s: "晒"
    	},
    	{
    		t: "厲",
    		m: "strict/severe",
    		s: "厉"
    	},
    	{
    		t: "李",
    		m: "plum"
    	},
    	{
    		t: "喲",
    		m: "oh",
    		s: "哟"
    	},
    	{
    		t: "噢",
    		m: "Oh!"
    	},
    	{
    		t: "饒",
    		m: "to spare//to forgive",
    		s: "饶"
    	},
    	{
    		t: "喔",
    		m: "I see/oh"
    	},
    	{
    		t: "胖",
    		m: "fat/plump"
    	},
    	{
    		t: "狸",
    		m: "raccoon dog/fox-like animal"
    	},
    	{
    		t: "媚",
    		m: "flatter/charm"
    	},
    	{
    		t: "籌",
    		m: "to raise (funds)",
    		s: "筹"
    	},
    	{
    		t: "晨",
    		m: "morning/dawn/daybreak"
    	},
    	{
    		t: "刃",
    		m: "edge of blade"
    	},
    	{
    		t: "允",
    		m: "to permit/to allow"
    	},
    	{
    		t: "窺",
    		m: "to peep/to pry into",
    		s: "窥"
    	},
    	{
    		t: "叢",
    		m: "cluster/collection/collection of books//thicket",
    		s: "丛"
    	},
    	{
    		t: "慄",
    		m: "afraid/trembling",
    		s: "栗"
    	},
    	{
    		t: "蒲",
    		m: "refers to various monocotyledonous flowering plants including acorus calamus and typha orientalis"
    	},
    	{
    		t: "蟒",
    		m: "python"
    	},
    	{
    		t: "飪",
    		m: "cooked food//to cook (until ready)",
    		s: "饪"
    	},
    	{
    		t: "份",
    		m: "variant of 分"
    	},
    	{
    		t: "劉",
    		m: "surname Liu",
    		s: "刘"
    	},
    	{
    		t: "囊",
    		m: "sack/purse/pocket"
    	},
    	{
    		t: "爾",
    		m: "thus/so/like that//you/thou",
    		s: "尔"
    	},
    	{
    		t: "卜",
    		m: "to divine/to forecast or estimate"
    	},
    	{
    		t: "耕",
    		m: "to plow/to till"
    	},
    	{
    		t: "哪",
    		m: "how//which"
    	},
    	{
    		t: "紫",
    		m: "purple/violet"
    	},
    	{
    		t: "眞",
    		m: "variant of 真"
    	},
    	{
    		t: "髓",
    		m: "essence/quintessence"
    	},
    	{
    		t: "敘",
    		m: "to narrate//to chat",
    		s: "叙"
    	},
    	{
    		t: "敍",
    		m: "variant of 敘",
    		s: "叙"
    	}
    ];

    exports.AppContainer = class AppContainer extends LitElement {
        constructor() {
            super();
            this.revealed = false;
            this.repeatCount = 0;
            this.repeatedFeedback = '';
            this.imgRollback = false;
            this.metadatasList = {};
            this.audioReady = false;
            exports.app = this;
        }
        getCharacter(hanja = this.hanja) {
            if (!hanja) {
                return undefined;
            }
            return hanja.s || hanja.t;
        }
        render() {
            // if (!this.hanja) {
            //   return nothing
            // }
            const c = this.getCharacter();
            return html `
    <div style="padding:6px;display:flex;justify-content:space-between;align-items:flex-start;">
      <span ?transparent="${!this.repeatedFeedback}"
        style="background-color:#a1887f;color:white;padding:7px;border-radius:4px;">${this.repeatedFeedback}</span>
      <mwc-icon-button icon="settings"
        @click="${_ => settings.show()}"></mwc-icon-button>
    </div>

    <div id="mainContainer">
      <div id="answer" ?transparent="${this.revealed === false}">
        <div ?hide="${this.imgRollback}" style="display:flex;justify-content:center;align-items:center;width:228px;height:228px;overflow:hidden">
          <img id="hanjaImg" src="${c ? `https://hangulhanja.com/api/images/hanmuns/${c}.gif` : ''}" width="230px"
            @click="${this.onImgClick}">
        </div>
        <div ?hide="${!this.imgRollback}" style="font-size:160px">${c}</div>
      </div>

      <div id="meaning">${this.hanja && this.hanja.m}</div>

      <div>
        ${!this.revealed ? html `<mwc-button icon="visibility" raised @click="${this.reveal}">reveal</mwc-button>` : nothing}
        
        ${this.revealed && settings.repeat && !this.repeatedFeedback ? html `
          <mwc-button icon="done" raised @click="${this.keep}">keep</mwc-button>
          <mwc-button icon="arrow_forward" trailingIcon raised @click="${this.next}">pass</mwc-button>
        ` : nothing}

        ${this.revealed && settings.repeat && this.repeatedFeedback ? html `
          <mwc-button icon="done" outlined @click="${this.iknow}" style="--mdc-theme-primary:#4caf50">i knew</mwc-button>
          <mwc-button icon="clear" outlined @click="${this.idontknow}" style="--mdc-theme-primary:#f44336">i didn't know</mwc-button>
        ` : nothing}

      </div>

      <div style="display:flex;align-items:center;margin: 10px 0 0 0;">
        <mwc-icon>reorder</mwc-icon><span style="margin-left:5px">bag: ${repeatList.length}</span>
      </div>
    </div>

    <div style="height:200px;"></div>

    <mwc-snackbar>
      <snackbar-button unelevated slot="action" ?disabled="${!this.metadatas}"
        icon="${this.metadatas ? 'remove_red_eye' : ''}"
        @click="${e => { e.stopPropagation(); this.hanjaMetadatasDialog.show(); }}">
        <mwc-circular-progress
          ?hide="${this.metadatas}"
          indeterminate
          style="width:24px;"></mwc-circular-progress>
      </snackbar-button>
      <snackbar-button unelevated slot="action" ?disabled="${!this.audioReady}"
        icon="${this.audioReady ? 'volume_up' : ''}"
        @click="${e => { e.stopPropagation(); this.playAudio(); }}">
        <mwc-circular-progress
          ?hide="${this.audioReady}"
          indeterminate
          style="width:24px;"></mwc-circular-progress>
      </snackbar-button>
    </mwc-snackbar>

    ${settings}

    <hanja-metadatas-dialog .metadatas="${this.metadatas}"></hanja-metadatas-dialog>
    `;
        }
        firstUpdated() {
            // image rollback
            this.shadowRoot.querySelector('#hanjaImg').onerror = () => {
                this.imgRollback = true;
            };
            // buttons icons in snackbar
            // this.snackbar.addEventListener('MDCSnackbar:opened', () => {
            //   this.snackbar.querySelectorAll('mwc-button').forEach(b => {
            //     b.constructor._styles.push(css`.mdc-button__icon { margin-right: 0 !important; }`);
            //     // b.shadowRoot.querySelector('.mdc-button__icon').style.marginRight = 0;
            //   });
            // })
            this.newQuestion();
            settings.addEventListener('update', e => {
                const detail = e.detail;
                if (detail.size > 1) {
                    return;
                }
                if (detail.has('repeatOnly')
                    || (detail.has('repeat') && detail.get('repeat') === true && settings.repeatOnly === true && !this.repeatedFeedback)
                    || (detail.has('repeat') && detail.get('repeat') === false && this.repeatedFeedback)) {
                    this.next();
                }
            });
        }
        reveal() {
            this.revealed = true;
        }
        keep() {
            repeatList.push(this.hanja);
            this.next();
        }
        iknow() {
            this.next();
        }
        idontknow() {
            this.next();
        }
        next() {
            this.imgRollback = false;
            this.newQuestion();
        }
        newQuestion() {
            const previousHanja = this.hanja;
            this.hanja = undefined; // reset the img
            let hanja;
            this.revealed = false;
            if (settings.repeat) {
                if (!settings.repeatOnly) {
                    this.repeatCount++;
                    if (this.repeatCount > settings.repeatEvery) {
                        if (this.repeatCount >= (settings.repeatEvery + (Math.min(settings.repeatLength, repeatList.length)))) {
                            this.repeatCount = 0;
                        }
                        // we grab a word from the list
                        // unless the list is empty
                        if (repeatList.length) {
                            do {
                                hanja = repeatList[Math.floor(Math.random() * repeatList.length)];
                            } while (repeatList.length !== 1 && hanja === previousHanja);
                            this.repeatedFeedback = 'repeated';
                        }
                    }
                }
                else {
                    // repeat mode
                    this.repeatedFeedback = 'repeat mode';
                    do {
                        hanja = repeatList[Math.floor(Math.random() * repeatList.length)];
                    } while (hanja === previousHanja);
                }
            }
            if (!hanja) {
                do {
                    hanja = this.getRandomHanja();
                } while (hanja === previousHanja && repeatList.indexOf(hanja) >= 0);
                this.repeatedFeedback = '';
                // if (settings.repeat) {
                //   repeatList.push(hanja);
                // }
            }
            this.hanja = hanja;
            // we start fetching the hanja's metadatas
            this.fetchHanjaMetadatas();
        }
        async fetchHanjaMetadatas(hanja = this.hanja) {
            this.metadatas = undefined;
            this.audioReady = false;
            this.openSnackbar('loading details...', -1);
            const character = this.getCharacter(hanja);
            if (!this.metadatasList[character]) {
                const response = await fetch(`https://assiets.vdegenne.com/api/words/chinese/${encodeURIComponent(this.getCharacter(hanja))}`);
                this.metadatasList[character] = await response.json();
            }
            this.metadatas = this.metadatasList[character];
            this.snackbar.labelText = 'loading audios...';
            // setTimeout(() => {
            this.audioReady = true;
            this.snackbar.labelText = 'data ready';
            this.playAudio();
            // }, 2000);
        }
        onImgClick() {
            window.open(`https://hangulhanja.com/hanja/${encodeURIComponent(this.hanja.t)}`, '_blank');
        }
        getRandomHanja() {
            return data[Math.floor(Math.random() * data.length)];
        }
        playAudio() {
            new Audio(this.metadatas.p[0].a).play();
            this.snackbar.labelText = this.metadatas.p.map(p => p.t).join(', ');
        }
        openSnackbar(text, timeoutMs = 5000) {
            this.snackbar.labelText = text;
            this.snackbar.timeoutMs = timeoutMs;
            this.snackbar.show();
        }
        clearCache() {
            repeatList.reset();
            repeatList.save();
            this.repeatCount = 0;
        }
    };
    exports.AppContainer.styles = styles;
    __decorate([
        property()
    ], exports.AppContainer.prototype, "hanja", void 0);
    __decorate([
        property({ type: Boolean, reflect: true })
    ], exports.AppContainer.prototype, "revealed", void 0);
    __decorate([
        property()
    ], exports.AppContainer.prototype, "repeatedFeedback", void 0);
    __decorate([
        property({ type: Boolean })
    ], exports.AppContainer.prototype, "imgRollback", void 0);
    __decorate([
        property({ type: Object })
    ], exports.AppContainer.prototype, "metadatas", void 0);
    __decorate([
        property({ type: Boolean })
    ], exports.AppContainer.prototype, "audioReady", void 0);
    __decorate([
        query('mwc-snackbar')
    ], exports.AppContainer.prototype, "snackbar", void 0);
    __decorate([
        query('hanja-metadatas-dialog')
    ], exports.AppContainer.prototype, "hanjaMetadatasDialog", void 0);
    exports.AppContainer = __decorate([
        customElement('app-container')
    ], exports.AppContainer);

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
