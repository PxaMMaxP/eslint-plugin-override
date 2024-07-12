const { ESLintUtils } = require('@typescript-eslint/utils');
const ts = require('typescript');

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure methods marked with @override are actually overridden in the derived class',
            category: 'Best Practices',
            recommended: false
        },
        messages: {
            noOverride: 'Method "{{ methodName }}" is marked with @override but is not overridden in the derived class.'
        },
        fixable: 'code', // This rule is fixable
        schema: [] // no options
    },
    create: function (context) {
        function handleClass(node) {
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
            const baseClassMethods = symbol.members ? Array.from(symbol.members.values()).filter(member => {
                return member.valueDeclaration && ts.isMethodDeclaration(member.valueDeclaration);
            }) : [];
            const overrideMethods = baseClassMethods.filter(method => {
                const comments = ts.getLeadingCommentRanges(
                    method.valueDeclaration.getFullText(),
                    0
                );
                if (!comments) {
                    return false;
                }
                return comments.some(comment => {
                    const commentText = method.valueDeclaration.getFullText().slice(comment.pos, comment.end);
                    return commentText.includes('@override');
                });
            });
            const derivedMethods = node.body.body.filter(method => method.type === 'MethodDefinition');
            overrideMethods.forEach(overrideMethod => {
                const methodName = overrideMethod.getName();
                const isOverridden = derivedMethods.some(derivedMethod => derivedMethod.key.name === methodName);
                if (!isOverridden) {
                    const modifiers = overrideMethod.valueDeclaration.modifiers ? overrideMethod.valueDeclaration.modifiers.map(mod => mod.getText()).join(' ') : '';
                    const parameters = overrideMethod.valueDeclaration.parameters.map(param => param.getText()).join(', ');
                    const returnType = overrideMethod.valueDeclaration.type ? `: ${overrideMethod.valueDeclaration.type.getText()}` : '';
                    context.report({
                        node: node,
                        messageId: 'noOverride',
                        data: {
                            methodName: methodName
                        },
                        fix: function (fixer) {
                            const methodText = `\n${modifiers} ${methodName}(${parameters})${returnType} { throw new Error('Method not implemented!'); }\n`;
                            const lastMethod = derivedMethods[derivedMethods.length - 1];
                            return fixer.insertTextAfter(lastMethod, methodText);
                        }
                    });
                }
            });
        }

        return {
            ClassDeclaration(node) {
                handleClass(node);
            },
            ClassExpression(node) {
                handleClass(node);
            }
        };
    }
};