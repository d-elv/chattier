import { useMutation } from "convex/react";
import { useState } from "react";

export const useMutationState = (mutationToRun: any) => {
  const [pending, setPending] = useState(false);
  const mutationFunction = useMutation(mutationToRun);

  const mutate = async (payload: any) => {
    setPending(true);

    return mutationFunction(payload)
      .then((response) => {
        return response;
      })
      .catch((error) => {
        throw error;
      })
      .finally(() => setPending(false));
  };

  return { mutate, pending };
};
