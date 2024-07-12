const { ESLintUtils } = require('@typescript-eslint/experimental-utils');
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
        schema: [] // no options
    },
    create: function (context) {
        // Function to handle both ClassDeclaration and ClassExpression
        function handleClass(node) {
            // console.debug('Handling class:', node.id ? node.id.name : '<anonymous>');

            // Check if the class has a superclass
            if (!node.superClass) {
                // console.debug('Class does not have a superclass.');
                return; // Class does not inherit from another class
            }

            // Access the parser services
            const services = ESLintUtils.getParserServices(context);
            const typeChecker = services.program.getTypeChecker();

            // Get the TypeScript node for the superclass
            const tsNode = services.esTreeNodeToTSNodeMap.get(node.superClass);
            const superClassType = typeChecker.getTypeAtLocation(tsNode);

            // Get the symbol for the superclass
            const symbol = superClassType.getSymbol();
            if (!symbol) {
                // console.debug('No symbol found for the superclass.');
                return; // No symbol found for the superclass
            }

            // Get methods from the base class
            const baseClassMethods = symbol.members ? Array.from(symbol.members.values()).filter(member => {
                return member.valueDeclaration && ts.isMethodDeclaration(member.valueDeclaration);
            }) : [];

            // console.debug('Base class methods:', baseClassMethods.map(m => m.getName()));

            // Filter methods marked with @override
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

            // console.debug('Base class methods marked with @override:', overrideMethods.map(m => m.getName()));

            // Get methods in the derived class
            const derivedMethods = node.body.body.filter(method => method.type === 'MethodDefinition');

            // Check if each @override method in the base class is overridden in the derived class
            overrideMethods.forEach(overrideMethod => {
                const methodName = overrideMethod.getName();
                const isOverridden = derivedMethods.some(derivedMethod => derivedMethod.key.name === methodName);

                if (!isOverridden) {
                    // console.debug(`Method not overridden: ${methodName}`);
                    // Report if the method is not overridden in the derived class
                    context.report({
                        node: node,
                        messageId: 'noOverride',
                        data: {
                            methodName: methodName
                        }
                    });
                } else {
                    // console.debug(`Method successfully overridden: ${methodName}`);
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
