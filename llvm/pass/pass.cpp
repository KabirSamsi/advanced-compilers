#include "llvm/Pass.h"
#include "llvm/IR/Module.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/Passes/PassPlugin.h"
#include "llvm/Support/raw_ostream.h"
#include "llvm/IR/InstrTypes.h"

using namespace llvm;

namespace {

    struct L7Pass : public PassInfoMixin<L7Pass> {
        PreservedAnalyses run(Module &M, ModuleAnalysisManager &AM) {
            for (auto &F : M.functions()) {
                for (auto &B : F) {
                    for (auto &I : B) {
                        if (auto *op = dyn_cast<BinaryOperator>(&I)) {
                            IRBuilder<> builder(op);
                            Value *left = I.getOperand(0);
                            Value *right = I.getOperand(1);

                            if ((I.getOpcode() == Instruction::SDiv)) {
                                if (auto *constInt = llvm::dyn_cast<llvm::ConstantInt>(right)) {
                                    int divisor = constInt->getValue().getSExtValue();
                                    if (divisor == 0) {
                                        errs() << "There is a likely zero division error here. To avoid this, let's just turn this into 0.\n";
                                        op->replaceAllUsesWith(builder.getInt32(0));
                                    } else {

                                        int oldDivisor = divisor;
                                        int srval = 0;
                                        while (divisor%2 == 0) {
                                            divisor /= 2;
                                            srval += 1;
                                        }

                                        Value* shift_right = builder.CreateLShr(left, builder.getInt32(srval));
                                        if (divisor == 1) {
                                            errs() << "Transforming division by " << oldDivisor << " into right-shifting by " << srval << "\n";
                                            for (auto& U : op->uses()) {
                                                User* user = U.getUser();
                                                user->setOperand(U.getOperandNo(), shift_right);
                                            }

                                        } else {
                                            errs() << "Transforming division by " << oldDivisor << " into right-shifting by " << srval << " and subsequent division by " << divisor << "\n";
                                            Value* residual_division = builder.CreateSDiv(shift_right, builder.getInt32(divisor));
                                            for (auto& U : op->uses()) {
                                                User* user = U.getUser();
                                                user->setOperand(U.getOperandNo(), residual_division);
                                            }
                                        }
                                    }
                                }

                            } else if ((I.getOpcode() == Instruction::Mul)) {
                                if (auto *lconst = llvm::dyn_cast<llvm::ConstantInt>(left)) {
                                    int lhs = lconst->getValue().getSExtValue();
                                    if (auto *rconst = llvm::dyn_cast<llvm::ConstantInt>(right)) {
                                        int rhs = rconst->getValue().getSExtValue();
                                        errs() << "Multiplication of constants can be propagated!\n";
                                        op->replaceAllUsesWith(builder.getInt32(rhs*lhs));

                                    } else {
                                        int oldMultiplier = lhs;
                                        int slval = 0;
                                        while (lhs%2 == 0) {
                                            lhs /= 2;
                                            slval += 1;
                                        }

                                        Value* shift_left = builder.CreateShl(left, builder.getInt32(slval));
                                        if (lhs == 1) {
                                            errs() << "Transforming multiplication by " << oldMultiplier << " into left-shifting by " << slval << "\n";
                                            op->replaceAllUsesWith(shift_left);
                                        } else {
                                            errs() << "Transforming multiplication by " << oldMultiplier << " into left-shifting by " << slval << " and subsequent multiplication by " << lhs << "\n";
                                            Value* residual_mult = builder.CreateMul(shift_left, builder.getInt32(lhs));
                                            for (auto& U : op->uses()) {
                                                User* user = U.getUser();
                                                user->setOperand(U.getOperandNo(), residual_mult);
                                            }
                                        }
                                    }
                                } else if (auto *rconst = llvm::dyn_cast<llvm::ConstantInt>(right)) {
                                    int rhs = rconst->getValue().getSExtValue();
                                    int oldMultiplier = rhs;
                                    int slval = 0;
                                    while (rhs%2 == 0) {
                                        rhs /= 2;
                                        slval += 1;
                                    }

                                    Value* shift_left = builder.CreateShl(left, builder.getInt32(slval));
                                    if (rhs == 1) {
                                        errs() << "Transforming multiplication by " << oldMultiplier << " into left-shifting by " << slval << "\n";
                                        for (auto& U : op->uses()) {
                                            User* user = U.getUser();
                                            user->setOperand(U.getOperandNo(), shift_left);
                                        }
                                    } else {
                                        errs() << "Transforming multiplication by " << oldMultiplier << " into left-shifting by " << slval << " and subsequent multiplication by " << rhs << "\n";
                                        Value* residual_mult = builder.CreateMul(shift_left, builder.getInt32(rhs));
                                        for (auto& U : op->uses()) {
                                            User* user = U.getUser();
                                            user->setOperand(U.getOperandNo(), residual_mult);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return PreservedAnalyses::all();
        };
    };
    
}

extern "C" LLVM_ATTRIBUTE_WEAK ::llvm::PassPluginLibraryInfo
llvmGetPassPluginInfo() {
    return {
        .APIVersion = LLVM_PLUGIN_API_VERSION,
        .PluginName = "L7 Pass (WIP)",
        .PluginVersion = "v0.1",
        .RegisterPassBuilderCallbacks = [](PassBuilder &PB) {
            PB.registerPipelineStartEPCallback(
                [](ModulePassManager &MPM, OptimizationLevel Level) {
                    MPM.addPass(L7Pass());
                });
        }
    };
}
