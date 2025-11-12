-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema clinica_db
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `clinica_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ;
USE `clinica_db` ;

-- -----------------------------------------------------
-- Table `clinica_db`.`medico`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`medico` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `especialidade` ENUM('Médico', 'Dentista', 'Psicólogo', 'Nutricionista', 'Fonoaudiólogo', 'Médico Veterinário', 'Fisioterapeuta', 'Terapeuta Ocupacional', 'Outro') NOT NULL,
  `registro_profissional` VARCHAR(15) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`clinica_gestor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`clinica_gestor` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome_clinica` VARCHAR(150) NOT NULL,
  `endereco` VARCHAR(200) NOT NULL,
  `telefone` VARCHAR(20) NOT NULL,
  `senha_mestre` VARCHAR(255) NOT NULL,
  `setor_id` INT NULL DEFAULT NULL,
  `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`vaga`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`vaga` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `medico_id` INT NOT NULL,
  `data` DATE NOT NULL,
  `dia_semana` ENUM('seg', 'ter', 'qua', 'qui', 'sex', 'sab') NULL DEFAULT NULL,
  `hora_inicio` TIME NOT NULL,
  `duracao_min` INT NOT NULL,
  `status` ENUM('pendente', 'confirmada', 'cancelada') NULL DEFAULT 'pendente',
  `criado_por` INT NOT NULL,
  `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `medico_id` (`medico_id` ASC) VISIBLE,
  INDEX `criado_por` (`criado_por` ASC) VISIBLE,
  CONSTRAINT `vaga_ibfk_1`
    FOREIGN KEY (`medico_id`)
    REFERENCES `clinica_db`.`medico` (`id`),
  CONSTRAINT `vaga_ibfk_2`
    FOREIGN KEY (`criado_por`)
    REFERENCES `clinica_db`.`clinica_gestor` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`setor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`setor` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(60) NOT NULL,
  `codigo` VARCHAR(5) NOT NULL,
  `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `codigo` (`codigo` ASC) VISIBLE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`bairro`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`bairro` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(80) NOT NULL,
  `setor_id` INT NOT NULL,
  `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `setor_id` (`setor_id` ASC) VISIBLE,
  CONSTRAINT `bairro_ibfk_1`
    FOREIGN KEY (`setor_id`)
    REFERENCES `clinica_db`.`setor` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`paciente`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`paciente` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `cartao_sus` VARCHAR(20) NULL DEFAULT NULL,
  `data_nascimento` DATE NOT NULL,
  `senha_cadastro` VARCHAR(255) NOT NULL,
  `telefone` VARCHAR(20) NULL DEFAULT NULL,
  `email` VARCHAR(100) NULL DEFAULT NULL,
  `bairro_id` INT NOT NULL,
  `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `observacoes` TEXT NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `cpf` (`cpf` ASC) VISIBLE,
  INDEX `bairro_id` (`bairro_id` ASC) VISIBLE,
  CONSTRAINT `paciente_ibfk_1`
    FOREIGN KEY (`bairro_id`)
    REFERENCES `clinica_db`.`bairro` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`agendamento`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`agendamento` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vaga_id` INT NOT NULL,
  `paciente_id` INT NOT NULL,
  `criado_por` INT NOT NULL,
  `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('pendente', 'confirmado', 'cancelado') NULL DEFAULT 'pendente',
  `motivo_cancelamento` TEXT NULL DEFAULT NULL,
  `checkin_em` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `vaga_id` (`vaga_id` ASC) VISIBLE,
  INDEX `paciente_id` (`paciente_id` ASC) VISIBLE,
  INDEX `criado_por` (`criado_por` ASC) VISIBLE,
  CONSTRAINT `agendamento_ibfk_1`
    FOREIGN KEY (`vaga_id`)
    REFERENCES `clinica_db`.`vaga` (`id`),
  CONSTRAINT `agendamento_ibfk_2`
    FOREIGN KEY (`paciente_id`)
    REFERENCES `clinica_db`.`paciente` (`id`),
  CONSTRAINT `agendamento_ibfk_3`
    FOREIGN KEY (`criado_por`)
    REFERENCES `clinica_db`.`clinica_gestor` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`comunicado`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`comunicado` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(150) NOT NULL,
  `corpo` TEXT NOT NULL,
  `criado_por` INT NOT NULL,
  `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `visibilidade` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `criado_por` (`criado_por` ASC) VISIBLE,
  INDEX `visibilidade` (`visibilidade` ASC) VISIBLE,
  CONSTRAINT `comunicado_ibfk_1`
    FOREIGN KEY (`criado_por`)
    REFERENCES `clinica_db`.`clinica_gestor` (`id`),
  CONSTRAINT `comunicado_ibfk_2`
    FOREIGN KEY (`visibilidade`)
    REFERENCES `clinica_db`.`setor` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `clinica_db`.`historico_auditoria`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `clinica_db`.`historico_auditoria` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `acao` ENUM('criado', 'atualizado', 'excluido') NOT NULL,
  `gestor_id` INT NOT NULL,
  `paciente_id` INT NOT NULL,
  `ocorrido_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `gestor_id` (`gestor_id` ASC) VISIBLE,
  INDEX `paciente_id` (`paciente_id` ASC) VISIBLE,
  CONSTRAINT `historico_auditoria_ibfk_1`
    FOREIGN KEY (`gestor_id`)
    REFERENCES `clinica_db`.`clinica_gestor` (`id`),
  CONSTRAINT `historico_auditoria_ibfk_2`
    FOREIGN KEY (`paciente_id`)
    REFERENCES `clinica_db`.`paciente` (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
