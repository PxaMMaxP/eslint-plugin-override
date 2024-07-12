const { ESLintUtils } = require('@typescript-eslint/utils');
const ts = require('typescript');

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure methods marked with @inheritdoc have matching comments with the base class method',
            category: 'Best Practices',
            recommended: false
        },
        messages: {
            noInheritdocMatch: 'Method "{{ methodName }}" is marked with @inheritdoc but the comments do not match the base class method.'
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
            const derivedMethods = node.body.body.filter(method => method.type === 'MethodDefinition');
            derivedMethods.forEach(derivedMethod => {
                const comments = ts.getLeadingCommentRanges(
                    derivedMethod.value.getFullText(),
                    0
                );
                if (!comments) {
                    return;
                }
                const inheritdocComment = comments.find(comment => {
                    const commentText = derivedMethod.value.getFullText().slice(comment.pos, comment.end);
                    return commentText.includes('@inheritdoc');
                });
                if (!inheritdocComment) {
                    return;
                }
                const methodName = derivedMethod.key.name;
                const baseMethod = baseClassMethods.find(method => method.getName() === methodName);
                if (!baseMethod) {
                    return;
                }
                const baseComments = ts.getLeadingCommentRanges(
                    baseMethod.valueDeclaration.getFullText(),
                    0
                );
                if (!baseComments) {
                    return;
                }
                const baseCommentText = baseMethod.valueDeclaration.getFullText().slice(baseComments[0].pos, baseComments[0].end).replace('@inheritdoc', '').trim();
                const derivedCommentText = derivedMethod.value.getFullText().slice(inheritdocComment.pos, inheritdocComment.end).replace('@inheritdoc', '').trim();
                if (baseCommentText !== derivedCommentText) {
                    context.report({
                        node: derivedMethod,
                        messageId: 'noInheritdocMatch',
                        data: {
                            methodName: methodName
                        },
                        fix: function (fixer) {
                            const fixedComment = derivedMethod.value.getFullText().slice(0, inheritdocComment.pos) + baseCommentText + derivedMethod.value.getFullText().slice(inheritdocComment.end);
                            return fixer.replaceTextRange([derivedMethod.range[0], derivedMethod.range[1]], fixedComment);
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