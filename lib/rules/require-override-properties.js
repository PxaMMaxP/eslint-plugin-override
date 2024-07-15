const { ESLintUtils } = require('@typescript-eslint/utils');
const ts = require('typescript');

// Function to get properties from the base class that are marked with @override
function getOverrideProperties(symbol, ts) {
    return symbol.members ? Array.from(symbol.members.values()).filter(member => {
        return member.valueDeclaration && ts.isPropertyDeclaration(member.valueDeclaration);
    }).filter(property => {
        const comments = ts.getLeadingCommentRanges(property.valueDeclaration.getFullText(), 0);
        if (!comments) return false;
        return comments.some(comment => {
            const commentText = property.valueDeclaration.getFullText().slice(comment.pos, comment.end);
            return commentText.includes('@override');
        });
    }) : [];
}

// Function to create fixes for missing overrides
function createFix(fixer, derivedProperties, overrideProperty, node) {
    const propertyName = overrideProperty.getName();
    const modifiers = overrideProperty.valueDeclaration.modifiers ? overrideProperty.valueDeclaration.modifiers.map(mod => mod.getText()).join(' ') : '';
    const type = overrideProperty.valueDeclaration.type ? `: ${overrideProperty.valueDeclaration.type.getText()}` : '';
    const initializer = overrideProperty.valueDeclaration.initializer ? ` = ${overrideProperty.valueDeclaration.initializer.getText()}` : '';
    const propertyText = `\n${modifiers} ${propertyName}${type}${initializer};\n`;

    if (derivedProperties.length > 0) {
        const lastProperty = derivedProperties[derivedProperties.length - 1];
        return fixer.insertTextAfter(lastProperty, propertyText);
    } else {
        // Insert the property before the closing brace of the class
        const classEnd = node.range[1] - 1;
        return fixer.insertTextBeforeRange([classEnd, classEnd], propertyText);
    }
}

// Function to check if properties in the derived class are overridden
function checkOverrideProperties(context, node, overrideProperties, derivedProperties) {
    overrideProperties.forEach(overrideProperty => {
        const propertyName = overrideProperty.getName();
        const isOverridden = derivedProperties.some(derivedProperty => derivedProperty.key.name === propertyName);
        if (!isOverridden) {
            context.report({
                node: node,
                messageId: 'noOverride',
                data: {
                    propertyName: propertyName
                },
                fix: function (fixer) {
                    return createFix(fixer, derivedProperties, overrideProperty, node);
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

    const overrideProperties = getOverrideProperties(symbol, ts);
    const derivedProperties = node.body.body.filter(member => member.type === 'ClassProperty');

    checkOverrideProperties(context, node, overrideProperties, derivedProperties);
}

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure properties marked with @override are actually overridden in the derived class',
            category: 'Best Practices',
            recommended: false
        },
        messages: {
            noOverride: 'Property "{{ propertyName }}" is marked with @override but is not overridden in the derived class.'
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
