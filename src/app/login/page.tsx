"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Lock, AtSign, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LoginForm = {
  email: string;
  senha: string;
};

export default function Login() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.senha,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMsg("Email ou senha inválidos. Tente novamente.");
      console.error(error);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="bg-white p-8 md:p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-black max-w-md mx-auto mt-8 md:mt-16 w-full">
      <div className="flex justify-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
          <Lock className="w-8 h-8" />
        </div>
      </div>
      <h2 className="text-3xl font-black mb-2 text-gray-900 tracking-tight text-center">
        Acesso Restrito
      </h2>
      <p className="text-gray-500 text-sm font-medium text-center mb-8">Faça login para gerenciar os resgates.</p>

      {errorMsg && (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 p-4 rounded-xl mb-6 flex items-start text-sm shadow-sm">
          <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">E-mail</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <AtSign className="w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="email"
              {...register("email", { required: "E-mail é obrigatório" })}
              className="w-full pl-11 bg-gray-50/50 border border-black rounded-xl p-3.5 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              placeholder="admin@sosmoto.com"
            />
          </div>
          {errors.email && <span className="text-red-500 text-sm mt-1.5 inline-block font-medium">{errors.email.message}</span>}
        </div>

        <div>
           <label className="block text-sm font-bold text-gray-700 mb-2">Senha</label>
           <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
             </div>
             <input
              type="password"
              {...register("senha", { required: "Senha é obrigatória" })}
              className="w-full pl-11 bg-gray-50/50 border border-black rounded-xl p-3.5 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              placeholder="••••••••"
             />
           </div>
           {errors.senha && <span className="text-red-500 text-sm mt-1.5 inline-block font-medium">{errors.senha.message}</span>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="relative w-full overflow-hidden bg-primary text-primary-foreground font-black text-lg py-4 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(0,0,255,0.39)] hover:shadow-[0_6px_20px_rgba(0,0,255,0.23)] hover:bg-blue-700 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-all duration-200 mt-2 flex items-center justify-center disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isSubmitting ? (
             <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Entrando...</>
          ) : (
            "FAZER LOGIN"
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Área restrita à equipe de resgate.</p>
        <a href="/" className="text-primary hover:underline mt-2 inline-block">Voltar para a página inicial</a>
      </div>
    </div>
  );
}
