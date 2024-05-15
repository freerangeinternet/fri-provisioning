import {ProvisioningDevice, ProvisioningState} from "@/types";

export type SoundEffect = "success" | "error"

export class SoundEffectPlayer {
    state = {
        cpe: {
            error: false,
            success: false,
        },
        router: {
            error: false,
            success: false,
        }
    }

    async play(soundEffect: SoundEffect, device: ProvisioningDevice) {
        if (device === "everything") {
            return
        }
        if (!this.state[device][soundEffect]) {
            this.state[device][soundEffect] = true
            await new Audio("/" + soundEffect + ".m4a").play()
        }
    }

    reset(device: ProvisioningDevice) {
        if (device === "everything") {
            this.reset("router")
            this.reset("cpe")
            return
        }
        this.state[device] = {
            error: false,
            success: false,
        }
    }

    async handle(s: ProvisioningState) {
        if (s.router.status === "success")
            await this.play("success", "router")
        if (s.router.status === "error")
            await this.play("error", "router")
        if (s.cpe.status === "success")
            await this.play("success", "cpe")
        if (s.cpe.status === "error")
            await this.play("error", "cpe")
    }
}