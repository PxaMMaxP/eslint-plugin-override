const { ESLintUtils } = require('@typescript-eslint/utils');
const ts = require('typescript');

// Function to get methods from the base class that are marked with @override
function getStaticOverrideMethods(symbol, ts) {
    return symbol.exports ? Array.from(symbol.exports.values()).filter(member => {
        return member.valueDeclaration && ts.isMethodDeclaration(member.valueDeclaration) &&
            member.valueDeclaration.modifiers && member.valueDeclaration.modifiers.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
    }).filter(method => {
        const comments = ts.getLeadingCommentRanges(method.valueDeclaration.getFullText(), 0);
        if (!comments) return false;
        return comments.some(comment => {
            const commentText = method.valueDeclaration.getFullText().slice(comment.pos, comment.end);
            return commentText.includes('@override');
        });
    }) : [];
}

// Function to create fixes for missing overrides
function createFix(fixer, derivedMethods, overrideMethod, node) {
    const methodName = overrideMethod.getName();
    const modifiers = overrideMethod.valueDeclaration.modifiers ? overrideMethod.valueDeclaration.modifiers.map(mod => mod.getText()).join(' ') : '';
    const parameters = overrideMethod.valueDeclaration.parameters.map(param => param.getText()).join(', ');
    const returnType = overrideMethod.valueDeclaration.type ? `: ${overrideMethod.valueDeclaration.type.getText()}` : '';
    const methodText = `\n${modifiers} ${methodName}(${parameters})${returnType} { throw new Error('Method not implemented!'); }\n`;
    const lastMethod = derivedMethods[derivedMethods.length - 1];

    if (derivedMethods.length > 0) {
        const lastMethod = derivedMethods[derivedMethods.length - 1];
        return fixer.insertTextAfter(lastMethod, methodText);
    } else {
        // Insert the method before the closing brace of the class
        const classEnd = node.range[1] - 1;
        return fixer.insertTextBeforeRange([classEnd, classEnd], methodText);
    }
}

// Function to check if methods in the derived class are overridden
function checkStaticOverrideMethods(context, node, overrideMethods, derivedMethods) {
    overrideMethods.forEach(overrideMethod => {
        const methodName = overrideMethod.getName();
        const isOverridden = derivedMethods.some(derivedMethod => derivedMethod.key.name === methodName);
        if (!isOverridden) {
            context.report({
                node: node,
                messageId: 'noOverride',
                data: {
                    methodName: methodName
                },
                fix: function (fixer) {
                    return createFix(fixer, derivedMethods, overrideMethod, node);
                }
            });
        }
    });
}

// Main function to process class nodes
function handleClass(context, node, ESLintUtils, ts) {
    if (!node.superClass) {
        return;
    }

    const services = ESLintUtils.getParserServices(context);
    const typeChecker = services.program.getTypeChecker();
    const tsNode = services.esTreeNodeToTSNodeMap.get(node.superClass);
    const superClassType = typeChecker.getTypeAtLocation(tsNode);
    const symbol = superClassType.getSymbol();

    if (!symbol) {
        return;
    }

    const staticOverrideMethods = getStaticOverrideMethods(symbol, ts);
    const derivedStaticMethods = node.body.body.filter(method => method.type === 'MethodDefinition' && method.static);

    checkStaticOverrideMethods(context, node, staticOverrideMethods, derivedStaticMethods);
}

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure static methods marked with @override are actually overridden in the derived class',
            category: 'Best Practices',
            recommended: false
        },
        messages: {
            noOverride: 'Static method "{{ methodName }}" is marked with @override but is not overridden in the derived class.'
        },
        fixable: 'code', // This rule is fixable
        schema: [] // no options
    },
    create: function (context) {
        return {
            ClassDeclaration(node) {
                handleClass(context, node, ESLintUtils, ts);
            },
            ClassExpression(node) {
                handleClass(context, node, ESLintUtils, ts);
            }
        };
    }
};
